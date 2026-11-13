import { collection, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const col = {
  users: () => collection(db, 'users'),
  cds: () => collection(db, 'cds'),
  jornadas: () => collection(db, 'jornadas'),
  alertas: () => collection(db, 'alertas'),
  kioscos: () => collection(db, 'kioscos'),
  bitacora: () => collection(db, 'bitacora'),
  notificaciones: () => collection(db, 'notificaciones'),
  solicitudes: () => collection(db, 'solicitudes'),
  invitaciones: () => collection(db, 'invitaciones'),
  reportes: () => collection(db, 'reportes'),
};

export const ref = {
  user: (uid: string) => doc(db, 'users', uid),
  cd: (id: string) => doc(db, 'cds', id),
  jornada: (id: string) => doc(db, 'jornadas', id),
  alerta: (id: string) => doc(db, 'alertas', id),
  kiosco: (cdId: string) => doc(db, 'kioscos', cdId),
  config: () => doc(db, 'config', 'general'),
  invitacion: (email: string) => doc(db, 'invitaciones', email.toLowerCase()),
  solicitud: (id: string) => doc(db, 'solicitudes', id),
  nuevo: (coleccion: keyof typeof col) => doc(col[coleccion]()),
};
