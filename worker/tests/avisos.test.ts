import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, doc, getDoc, setDoc, setLogLevel } from 'firebase/firestore';
// @ts-expect-error módulo JS del Worker
import worker, { crearContexto, procesarPendientes, verificarIdToken, firmarJwt } from '../src/index.js';

const PROJECT = 'demo-marcacion';
const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
let env: RulesTestEnvironment;

interface Envio {
  token: string;
  data: Record<string, string>;
}
let envios: Envio[] = [];
let vencidos = new Set<string>();

function ctxPrueba(extra: Record<string, unknown> = {}) {
  return crearContexto(
    {
      PROJECT_ID: PROJECT,
      FIRESTORE_URL: `http://${HOST}/v1`,
      FCM_URL: 'https://fcm.prueba/v1',
      TOKEN_FIJO: 'owner',
    },
    {
      fetch: async (url: string, init?: RequestInit) => {
        if (String(url).startsWith('https://fcm.prueba/')) {
          const m = JSON.parse(String(init?.body)).message;
          if (vencidos.has(m.token))
            return new Response('{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}', {
              status: 404,
            });
          envios.push({ token: m.token, data: m.webpush.data });
          return new Response('{"name":"ok"}', { status: 200 });
        }
        return fetch(url, init);
      },
      ...extra,
    },
  );
}

const usuario = (uid: string, rol: string, cdId: string, estado = 'activo') => ({
  uid,
  rol,
  cdId,
  estado,
  nombre: uid,
  apellidos: 'X',
});
const notif = (extra: Record<string, unknown>) => ({
  para: 'staff',
  uid: null,
  cdId: '5184',
  tipo: 'alerta',
  texto: 'Carlos: marcó a 2 km',
  enlace: 'alertas/j1_entrada',
  creadoPor: 'g1',
  creadoEn: Timestamp.now(),
  leidaPor: [],
  ...extra,
});

beforeAll(async () => {
  setLogLevel('silent');
  const [host, port] = HOST.split(':');
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: {
      host,
      port: Number(port),
      rules: 'service cloud.firestore { match /{d=**} { allow read, write: if false; } }',
    },
  });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  envios = [];
  vencidos = new Set();
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    const users = [
      usuario('admin1', 'admin', '5184'),
      usuario('admin2', 'admin', '7417'),
      usuario('adminBloq', 'admin', '5184', 'bloqueado'),
      usuario('pa5184', 'pa', '5184'),
      usuario('pa7417', 'pa', '7417'),
      usuario('g1', 'seguridad', '5184'),
      usuario('g2', 'seguridad', '5184'),
    ];
    for (const u of users) {
      await setDoc(doc(db, 'users', u.uid), u);
      await setDoc(doc(db, 'tokensPush', `tok-${u.uid}`), {
        uid: u.uid,
        dispositivo: 'Android',
        actualizadoEn: Timestamp.now(),
      });
    }
  });
});

async function sembrarNotif(id: string, datos: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'notificaciones', id), datos);
  });
}
const destinos = () => envios.map((e) => e.token).sort();

describe('Worker de avisos · destinatarios por rol', () => {
  it('una alerta llega a los admins activos y al PA de ese CD, no a otros ni a quien la creó', async () => {
    await sembrarNotif('n1', notif({}));
    expect(await procesarPendientes(ctxPrueba())).toBe(3);
    expect(destinos()).toEqual(['tok-admin1', 'tok-admin2', 'tok-pa5184']);
    const e = envios.find((x) => x.token === 'tok-pa5184')!;
    expect(e.data).toMatchObject({
      titulo: 'Marcación CD',
      cuerpo: 'Carlos: marcó a 2 km',
      url: '/pa/alertas/j1_entrada',
      tag: 'n1',
    });
    expect(envios.find((x) => x.token === 'tok-admin1')!.data.url).toBe('/admin/alertas/j1_entrada');
  });

  it('un aviso "solo admin" (registro o solicitud) no le llega al PA', async () => {
    await sembrarNotif('n2', notif({ para: 'admin', tipo: 'solicitud', enlace: 'solicitudes' }));
    await procesarPendientes(ctxPrueba());
    expect(destinos()).toEqual(['tok-admin1', 'tok-admin2']);
  });

  it('un aviso para un usuario solo le llega a esa persona, con su enlace de guardia', async () => {
    await sembrarNotif(
      'n3',
      notif({ para: 'usuario', uid: 'g2', tipo: 'firma_habilitada', enlace: 'firma', creadoPor: 'admin1' }),
    );
    await procesarPendientes(ctxPrueba());
    expect(envios).toHaveLength(1);
    expect(envios[0]).toMatchObject({ token: 'tok-g2', data: { url: '/app/firma' } });
  });
});

describe('Worker de avisos · confiabilidad', () => {
  it('nunca envía dos veces el mismo aviso y lo marca como enviado', async () => {
    await sembrarNotif('n1', notif({}));
    await procesarPendientes(ctxPrueba());
    await procesarPendientes(ctxPrueba());
    expect(envios).toHaveLength(3);
    await env.withSecurityRulesDisabled(async (c) => {
      expect((await getDoc(doc(c.firestore(), 'notificaciones/n1'))).data()?.push).toBe('enviada:3');
    });
  });

  it('dos ejecuciones al mismo tiempo no duplican el envío', async () => {
    await sembrarNotif('n1', notif({}));
    await Promise.all([procesarPendientes(ctxPrueba()), procesarPendientes(ctxPrueba())]);
    expect(envios).toHaveLength(3);
  });

  it('ignora los avisos viejos (más de 30 min)', async () => {
    await sembrarNotif('viejo', notif({ creadoEn: Timestamp.fromMillis(Date.now() - 2 * 3600_000) }));
    expect(await procesarPendientes(ctxPrueba())).toBe(0);
  });

  it('borra los tokens de teléfonos que ya no existen', async () => {
    vencidos.add('tok-pa5184');
    await sembrarNotif('n1', notif({}));
    await procesarPendientes(ctxPrueba());
    await env.withSecurityRulesDisabled(async (c) => {
      expect((await getDoc(doc(c.firestore(), 'tokensPush/tok-pa5184'))).exists()).toBe(false);
      expect((await getDoc(doc(c.firestore(), 'tokensPush/tok-admin1'))).exists()).toBe(true);
    });
  });
});

describe('Worker de avisos · seguridad del endpoint', () => {
  let claves: CryptoKeyPair;
  let pem: string;
  let jwk: JsonWebKey & { kid: string };
  beforeAll(async () => {
    claves = (await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    const pk = Buffer.from(await crypto.subtle.exportKey('pkcs8', claves.privateKey)).toString('base64');
    pem = `-----BEGIN PRIVATE KEY-----\n${pk}\n-----END PRIVATE KEY-----\n`;
    jwk = { ...(await crypto.subtle.exportKey('jwk', claves.publicKey)), kid: 'k1' };
  });
  async function idToken(claims: Record<string, unknown>) {
    const ahora = Math.floor(Date.now() / 1000);
    const t = await firmarJwt(
      {
        iss: `https://securetoken.google.com/${PROJECT}`,
        aud: PROJECT,
        iat: ahora,
        exp: ahora + 3600,
        sub: 'g1',
        ...claims,
      },
      pem,
    );
    // firmarJwt no pone kid: lo agregamos rehaciendo el encabezado.
    const [, p] = t.split('.');
    const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'k1' })).toString('base64url');
    const sig = Buffer.from(
      await crypto.subtle.sign('RSASSA-PKCS1-v1_5', claves.privateKey, new TextEncoder().encode(`${h}.${p}`)),
    ).toString('base64url');
    return `${h}.${p}.${sig}`;
  }

  it('acepta un ID token válido de este proyecto', async () => {
    expect(await verificarIdToken(await idToken({}), PROJECT, { jwks: [jwk] })).toBe('g1');
  });
  it('rechaza tokens de otro proyecto, vencidos o alterados', async () => {
    expect(await verificarIdToken(await idToken({ aud: 'otro' }), PROJECT, { jwks: [jwk] })).toBeNull();
    expect(
      await verificarIdToken(await idToken({ exp: Math.floor(Date.now() / 1000) - 10 }), PROJECT, {
        jwks: [jwk],
      }),
    ).toBeNull();
    const t = await idToken({});
    expect(await verificarIdToken(t.slice(0, -4) + 'AAAA', PROJECT, { jwks: [jwk] })).toBeNull();
    expect(await verificarIdToken('basura', PROJECT, { jwks: [jwk] })).toBeNull();
  });
  it('el endpoint responde 401 sin sesión y atiende CORS', async () => {
    const e = { PROJECT_ID: PROJECT, FIRESTORE_URL: `http://${HOST}/v1`, TOKEN_FIJO: 'owner' };
    const sin = await worker.fetch(new Request('https://w.dev/enviar', { method: 'POST' }), e);
    expect(sin.status).toBe(401);
    const pre = await worker.fetch(new Request('https://w.dev/enviar', { method: 'OPTIONS' }), e);
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
