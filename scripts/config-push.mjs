// Guarda en config/push la dirección del Worker de avisos para que la app la use.
// Lo ejecuta el workflow "avisos" después de desplegar el Worker.
import { FieldValue } from 'firebase-admin/firestore';
import { iniciar } from './_admin.mjs';

const url = (process.env.PUSH_URL || '').trim().replace(/\/$/, '');
if (!/^https:\/\/[a-z0-9.-]+\.workers\.dev$/i.test(url)) {
  console.error(`Dirección del Worker no válida: "${url}"`);
  process.exit(1);
}
const { db } = iniciar();
await db.doc('config/push').set({ url, actualizadoEn: FieldValue.serverTimestamp() });
console.log(`✓ La app enviará los avisos a ${url}`);
