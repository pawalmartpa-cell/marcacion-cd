/**
 * Marcación CD · Worker de avisos push.
 *
 * - POST /enviar  (con el ID token de Firebase del usuario): procesa al instante los avisos pendientes.
 * - Cron cada minuto: respaldo por si algún aviso quedó sin enviar.
 *
 * Para cada documento de `notificaciones` reciente sin el campo `push`:
 *   1. Lo "reserva" (precondición de updateTime) para que nunca se envíe dos veces.
 *   2. Calcula los destinatarios con las mismas reglas de la app:
 *        staff   → admins activos + PA activos del CD
 *        admin   → admins activos
 *        usuario → esa persona
 *      (nunca a quien lo creó).
 *   3. Envía con FCM a los teléfonos registrados en `tokensPush` y borra los tokens vencidos.
 *
 * Sin dependencias: solo fetch y WebCrypto.
 */

const SCOPES = 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging';
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const VENTANA_MIN = 30;
const TITULO = 'Marcación CD';
const BASE_POR_ROL = { admin: '/admin', pa: '/pa', seguridad: '/app', kiosco: '/kiosco' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

// ---------------------------------------------------------------- base64url
const enc = new TextEncoder();
function b64url(bytes) {
  let s = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlTexto(t) {
  return b64url(enc.encode(t));
}
function deB64url(t) {
  const s = atob(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------- cuenta de servicio → token OAuth
let tokenCache = null;

async function importarPem(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
    'sign',
  ]);
}

export async function firmarJwt(claims, privateKeyPem) {
  const unsigned = `${b64urlTexto(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64urlTexto(JSON.stringify(claims))}`;
  const key = await importarPem(privateKeyPem);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsigned));
  return `${unsigned}.${b64url(sig)}`;
}

async function tokenAcceso(ctx) {
  if (ctx.tokenFijo) return ctx.tokenFijo;
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const ahora = Math.floor(Date.now() / 1000);
  const jwt = await firmarJwt(
    {
      iss: ctx.sa.client_email,
      scope: SCOPES,
      aud: 'https://oauth2.googleapis.com/token',
      iat: ahora,
      exp: ahora + 3600,
    },
    ctx.sa.private_key,
  );
  const r = await ctx.fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  if (!r.ok) throw new Error(`OAuth ${r.status}: ${await r.text()}`);
  const j = await r.json();
  tokenCache = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return tokenCache.token;
}

// ---------------------------------------------------------------- verificar el ID token del usuario
let jwksCache = null;

async function jwks(ctx) {
  if (ctx.jwks) return ctx.jwks;
  if (jwksCache && jwksCache.exp > Date.now()) return jwksCache.keys;
  const r = await ctx.fetch(JWKS_URL);
  if (!r.ok) throw new Error('No se pudieron leer las llaves públicas de Firebase');
  const edad = Number(/max-age=(\d+)/.exec(r.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  const { keys } = await r.json();
  jwksCache = { keys, exp: Date.now() + edad * 1000 };
  return keys;
}

/** Devuelve el uid si el ID token de Firebase es válido para este proyecto; si no, null. */
export async function verificarIdToken(token, projectId, ctx) {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const header = JSON.parse(new TextDecoder().decode(deB64url(h)));
    const claims = JSON.parse(new TextDecoder().decode(deB64url(p)));
    if (header.alg !== 'RS256') return null;
    const jwk = (await jwks(ctx)).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, deB64url(s), enc.encode(`${h}.${p}`));
    const ahora = Math.floor(Date.now() / 1000);
    if (
      !ok ||
      claims.aud !== projectId ||
      claims.iss !== `https://securetoken.google.com/${projectId}` ||
      !(claims.exp > ahora) ||
      !(claims.iat <= ahora + 300) ||
      typeof claims.sub !== 'string' ||
      !claims.sub
    )
      return null;
    return claims.sub;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Firestore REST
function valor(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(valor);
  if ('mapValue' in v) return campos(v.mapValue.fields ?? {});
  return null;
}
function campos(f) {
  const o = {};
  for (const [k, v] of Object.entries(f ?? {})) o[k] = valor(v);
  return o;
}
function aValor(x) {
  if (x === null) return { nullValue: null };
  if (typeof x === 'string') return { stringValue: x };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(aValor) } };
  throw new Error('tipo no soportado');
}

class Firestore {
  constructor(ctx) {
    this.ctx = ctx;
    this.raiz = `${ctx.firestoreUrl}/projects/${ctx.projectId}/databases/(default)/documents`;
  }
  async h() {
    return { Authorization: `Bearer ${await tokenAcceso(this.ctx)}`, 'Content-Type': 'application/json' };
  }
  async consulta(coleccion, filtros, extra = {}) {
    const where =
      filtros.length === 1
        ? { fieldFilter: filtros[0] }
        : { compositeFilter: { op: 'AND', filters: filtros.map((f) => ({ fieldFilter: f })) } };
    const r = await this.ctx.fetch(`${this.raiz}:runQuery`, {
      method: 'POST',
      headers: await this.h(),
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: coleccion }], where, ...extra } }),
    });
    if (!r.ok) throw new Error(`runQuery ${coleccion} ${r.status}: ${await r.text()}`);
    const filas = await r.json();
    return filas
      .filter((f) => f.document)
      .map((f) => ({
        name: f.document.name,
        id: f.document.name.split('/').pop(),
        updateTime: f.document.updateTime,
        data: campos(f.document.fields),
      }));
  }
  /** Actualiza campos; con `precondicion` falla (false) si el documento cambió desde que se leyó. */
  async parchar(name, datos, precondicion) {
    const fields = Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, aValor(v)]));
    const write = { update: { name, fields }, updateMask: { fieldPaths: Object.keys(datos) } };
    if (precondicion) write.currentDocument = { updateTime: precondicion };
    const r = await this.ctx.fetch(`${this.raiz}:commit`, {
      method: 'POST',
      headers: await this.h(),
      body: JSON.stringify({ writes: [write] }),
    });
    return r.ok;
  }
  async borrar(name) {
    await this.ctx.fetch(`${this.ctx.firestoreUrl}/${name}`, { method: 'DELETE', headers: await this.h() });
  }
}

const f = (campo, op, v) => ({ field: { fieldPath: campo }, op, value: aValor(v) });

// ---------------------------------------------------------------- destinatarios y envío
async function destinatarios(db, n) {
  let usuarios = [];
  if (n.para === 'usuario' && n.uid) {
    usuarios = await db.consulta('users', [f('uid', 'EQUAL', n.uid), f('estado', 'EQUAL', 'activo')]);
  } else {
    usuarios = await db.consulta('users', [f('rol', 'EQUAL', 'admin'), f('estado', 'EQUAL', 'activo')]);
    if (n.para === 'staff' && n.cdId) {
      usuarios = usuarios.concat(
        await db.consulta('users', [
          f('rol', 'EQUAL', 'pa'),
          f('cdId', 'EQUAL', n.cdId),
          f('estado', 'EQUAL', 'activo'),
        ]),
      );
    }
  }
  const porUid = new Map();
  for (const u of usuarios) if (u.id !== n.creadoPor) porUid.set(u.id, u.data.rol);
  return porUid;
}

async function tokensDe(db, uids) {
  const out = [];
  for (let i = 0; i < uids.length; i += 30) {
    const lote = uids.slice(i, i + 30);
    out.push(...(await db.consulta('tokensPush', [f('uid', 'IN', lote)])));
  }
  return out;
}

async function enviarFcm(ctx, token, datos) {
  const r = await ctx.fetch(`${ctx.fcmUrl}/projects/${ctx.projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await tokenAcceso(ctx)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: { token, webpush: { headers: { Urgency: 'high', TTL: '86400' }, data: datos } },
    }),
  });
  if (r.ok) return 'ok';
  const t = await r.text();
  // Token vencido o de una app desinstalada: hay que borrarlo.
  if (r.status === 404 || /UNREGISTERED|registration-token-not-registered/.test(t)) return 'vencido';
  if (r.status === 400 && /INVALID_ARGUMENT/.test(t) && /token/i.test(t)) return 'vencido';
  console.warn('FCM', r.status, t.slice(0, 300));
  return 'error';
}

/** Procesa los avisos recientes que aún no se enviaron. Devuelve cuántas notificaciones push salieron. */
export async function procesarPendientes(ctx) {
  const db = new Firestore(ctx);
  const desde = new Date(Date.now() - VENTANA_MIN * 60_000).toISOString();
  const recientes = await db.consulta(
    'notificaciones',
    [{ field: { fieldPath: 'creadoEn' }, op: 'GREATER_THAN_OR_EQUAL', value: { timestampValue: desde } }],
    {
      orderBy: [{ field: { fieldPath: 'creadoEn' }, direction: 'ASCENDING' }],
      limit: 100,
    },
  );
  let enviadas = 0;
  for (const doc of recientes) {
    const n = doc.data;
    if (n.push) continue;
    // Reserva: si otra ejecución ya lo tomó (o cambió), se salta.
    if (!(await db.parchar(doc.name, { push: 'enviando' }, doc.updateTime))) continue;
    let ok = 0;
    try {
      const porUid = await destinatarios(db, n);
      const tokens = porUid.size ? await tokensDe(db, [...porUid.keys()]) : [];
      for (const t of tokens) {
        const rol = porUid.get(t.data.uid);
        const base = BASE_POR_ROL[rol] ?? '/';
        const url = n.enlace ? `${base}/${n.enlace}` : base;
        const r = await enviarFcm(ctx, t.id, {
          titulo: ctx.titulo ?? TITULO,
          cuerpo: String(n.texto ?? ''),
          url,
          tag: doc.id,
        });
        if (r === 'ok') ok++;
        else if (r === 'vencido') await db.borrar(t.name);
      }
    } finally {
      await db.parchar(doc.name, { push: `enviada:${ok}` });
    }
    enviadas += ok;
  }
  return enviadas;
}

// ---------------------------------------------------------------- entrada del Worker
export function crearContexto(env, extra = {}) {
  const sa = env.SERVICE_ACCOUNT ? JSON.parse(env.SERVICE_ACCOUNT) : {};
  return {
    sa,
    projectId: env.PROJECT_ID ?? sa.project_id,
    firestoreUrl: env.FIRESTORE_URL ?? 'https://firestore.googleapis.com/v1',
    fcmUrl: env.FCM_URL ?? 'https://fcm.googleapis.com/v1',
    tokenFijo: env.TOKEN_FIJO,
    fetch: (...a) => fetch(...a),
    ...extra,
  };
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/')
      return json({ ok: true, servicio: 'marcacion-avisos' });
    if (request.method !== 'POST' || url.pathname !== '/enviar') return json({ error: 'no encontrado' }, 404);
    const ctx = crearContexto(env);
    const bearer = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const uid = bearer ? await verificarIdToken(bearer, ctx.projectId, ctx) : null;
    if (!uid) return json({ error: 'no autorizado' }, 401);
    try {
      return json({ enviadas: await procesarPendientes(ctx) });
    } catch (e) {
      console.error(e);
      return json({ error: 'falló el envío' }, 500);
    }
  },
  async scheduled(_evento, env, ctxWorker) {
    ctxWorker.waitUntil(procesarPendientes(crearContexto(env)).catch((e) => console.error(e)));
  },
};
