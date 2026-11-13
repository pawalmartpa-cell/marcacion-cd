import { getDocs, orderBy, query, where, type QueryConstraint } from 'firebase/firestore';
import { col } from '@/data/refs';
import type { Alerta, Cd, EntradaBitacora, Jornada, Usuario } from '@/types';
import { fechaCorta, fechaHora, hora, isoADate, sumarDiasISO, duracionTexto } from './fechas';
import {
  estadoJornada,
  esTarde,
  horaEfectiva,
  jornadaVigente,
  metodoTexto,
  minutosTarde,
  minutosTrabajados,
} from './jornada';
import { distanciaTexto } from './geo';
import { firmaAPng } from './firma';

export type TipoReporte = 'guardia' | 'cd' | 'tardanzas' | 'alertas' | 'bitacora';
export const TIPOS_REPORTE: Record<TipoReporte, string> = {
  guardia: 'Asistencia por guardia',
  cd: 'Asistencia por CD',
  tardanzas: 'Tardanzas y salidas sin marcar',
  alertas: 'Alertas de ubicación',
  bitacora: 'Bitácora de ediciones',
};

/**
 * Columnas de la hoja de papel (provisionales hasta recibir la hoja real).
 * Para cambiar el orden basta con reordenar esta lista.
 */
export const COLUMNAS_HOJA = ['Fecha', 'Guardia', 'CD', 'Turno', 'Entrada', 'Salida', 'Firma'] as const;

export interface ParametrosReporte {
  tipo: TipoReporte;
  formato: 'Excel' | 'PDF';
  desde: string;
  hasta: string;
  cdId: string | null;
  uidGuardia: string | null;
  incluirFirma: boolean;
}

export interface Contexto {
  usuarios: Map<string, Usuario>;
  cds: Map<string, Cd>;
  nombreApp: string;
  generadoPor: string;
}

interface Tabla {
  titulo: string;
  columnas: string[];
  filas: Array<Array<string | number>>;
  /** Índice de la columna de firma y uid del guardia de cada fila. */
  colFirma?: number;
  uidsFila?: string[];
  anchos?: number[];
}

const cdTxt = (ctx: Contexto, id: string) => {
  const c = ctx.cds.get(id);
  return c ? `${c.nombre} ${c.codigo}` : id;
};

async function cargarJornadas(p: ParametrosReporte): Promise<Jornada[]> {
  // El PA siempre filtra por su CD (las reglas no filtran por sí solas).
  const c: QueryConstraint[] = [];
  if (p.cdId) c.push(where('cdId', '==', p.cdId));
  if (p.uidGuardia) c.push(where('uid', '==', p.uidGuardia));
  c.push(where('fecha', '>=', p.desde), where('fecha', '<=', p.hasta), orderBy('fecha', 'desc'));
  const s = await getDocs(query(col.jornadas(), ...c));
  const js = s.docs.map((d) => ({ ...(d.data() as Jornada), id: d.id }));
  return js.sort((a, b) =>
    a.fecha === b.fecha ? a.nombre.localeCompare(b.nombre) : a.fecha.localeCompare(b.fecha),
  );
}

async function cargarAlertas(p: ParametrosReporte): Promise<Alerta[]> {
  const c: QueryConstraint[] = [];
  if (p.cdId) c.push(where('cdId', '==', p.cdId));
  c.push(
    where('creadoEn', '>=', isoADate(p.desde)),
    where('creadoEn', '<', isoADate(sumarDiasISO(p.hasta, 1))),
    orderBy('creadoEn', 'desc'),
  );
  const s = await getDocs(query(col.alertas(), ...c));
  let a = s.docs.map((d) => ({ ...(d.data() as Alerta), id: d.id }));
  if (p.uidGuardia) a = a.filter((x) => x.uid === p.uidGuardia);
  return a;
}

async function cargarBitacora(p: ParametrosReporte): Promise<EntradaBitacora[]> {
  const c: QueryConstraint[] = [];
  if (p.cdId) c.push(where('cdId', '==', p.cdId));
  c.push(
    where('fecha', '>=', isoADate(p.desde)),
    where('fecha', '<', isoADate(sumarDiasISO(p.hasta, 1))),
    orderBy('fecha', 'desc'),
  );
  const s = await getDocs(query(col.bitacora(), ...c));
  return s.docs.map((d) => ({ ...(d.data() as EntradaBitacora), id: d.id }));
}

function filaHoja(j: Jornada, ctx: Contexto, firma: boolean): Array<string | number> {
  const valores: Record<(typeof COLUMNAS_HOJA)[number], string> = {
    Fecha: fechaCorta(j.fecha),
    Guardia: j.nombre,
    CD: cdTxt(ctx, j.cdId),
    Turno: j.turno.inicio ? `${j.turno.nombre} (${j.turno.inicio}–${j.turno.fin})` : j.turno.nombre,
    Entrada: hora(horaEfectiva(j.entrada)),
    Salida: j.salida ? hora(horaEfectiva(j.salida)) : '—',
    Firma: firma ? '' : '',
  };
  return COLUMNAS_HOJA.map((c) => valores[c]);
}

export async function construirTablas(p: ParametrosReporte, ctx: Contexto): Promise<Tabla[]> {
  if (p.tipo === 'guardia' || p.tipo === 'cd') {
    const js = await cargarJornadas(p);
    const hoja: Tabla = {
      titulo: 'Asistencia',
      columnas: [...COLUMNAS_HOJA].filter((c) => p.incluirFirma || c !== 'Firma'),
      filas: js.map((j) => {
        const f = filaHoja(j, ctx, p.incluirFirma);
        return p.incluirFirma ? f : f.filter((_, i) => COLUMNAS_HOJA[i] !== 'Firma');
      }),
      colFirma: p.incluirFirma ? COLUMNAS_HOJA.indexOf('Firma') : undefined,
      uidsFila: js.map((j) => j.uid),
      anchos: [12, 26, 22, 24, 10, 10, 30],
    };
    const detalle: Tabla = {
      titulo: 'Detalle',
      columnas: [
        'Fecha',
        'Guardia',
        'Turno',
        'Entrada',
        'Método entrada',
        'Distancia',
        'Salida',
        'Método salida',
        'Distancia',
        'Horas',
        'Estado',
        'Tarde (min)',
        'Editada',
      ],
      filas: js.map((j) => [
        fechaCorta(j.fecha),
        j.nombre,
        j.turno.nombre,
        hora(horaEfectiva(j.entrada)),
        metodoTexto(j.entrada),
        distanciaTexto(j.entrada.distanciaM),
        j.salida ? hora(horaEfectiva(j.salida)) : '—',
        j.salida ? metodoTexto(j.salida) : '—',
        j.salida ? distanciaTexto(j.salida.distanciaM) : '—',
        duracionTexto(minutosTrabajados(j)),
        estadoJornada(j).texto,
        minutosTarde(j) || '',
        j.editada ? 'Sí' : '',
      ]),
    };
    return [hoja, detalle];
  }
  if (p.tipo === 'tardanzas') {
    const js = (await cargarJornadas(p)).filter((j) => esTarde(j) || (!j.salida && !jornadaVigente(j)));
    return [
      {
        titulo: 'Tardanzas y sin salida',
        columnas: [
          'Fecha',
          'Guardia',
          'CD',
          'Turno',
          'Inicio turno',
          'Entrada',
          'Salida',
          'Minutos tarde',
          'Problema',
        ],
        filas: js.map((j) => [
          fechaCorta(j.fecha),
          j.nombre,
          cdTxt(ctx, j.cdId),
          j.turno.nombre,
          j.turno.inicio || '[hh:mm]',
          hora(horaEfectiva(j.entrada)),
          j.salida ? hora(horaEfectiva(j.salida)) : '—',
          minutosTarde(j) || '',
          [esTarde(j) ? 'Tardanza' : '', !j.salida ? 'Salida sin marcar' : ''].filter(Boolean).join(' y '),
        ]),
        anchos: [12, 26, 22, 12, 12, 10, 10, 14, 26],
      },
    ];
  }
  if (p.tipo === 'alertas') {
    const as = await cargarAlertas(p);
    const EST = { abierta: 'Abierta', aceptada: 'Aceptada', rechazada: 'Rechazada' } as const;
    return [
      {
        titulo: 'Alertas',
        columnas: [
          'Fecha y hora',
          'Guardia',
          'CD',
          'Marca',
          'Severidad',
          'Detalle',
          'Distancia',
          'Estado',
          'Resuelta por',
          'Comentario',
        ],
        filas: as.map((a) => [
          fechaHora(a.creadoEn),
          a.nombre,
          cdTxt(ctx, a.cdId),
          a.parte === 'entrada' ? 'Entrada' : 'Salida',
          a.severidad === 'alta' ? 'Alta' : a.severidad === 'media' ? 'Media' : 'Info',
          a.texto,
          distanciaTexto(a.distanciaM),
          EST[a.estado],
          a.resueltoNombre ?? '',
          a.comentario ?? '',
        ]),
        anchos: [17, 24, 20, 10, 10, 50, 10, 11, 22, 30],
      },
    ];
  }
  const bs = await cargarBitacora(p);
  return [
    {
      titulo: 'Bitácora',
      columnas: ['Fecha y hora', 'Quién', 'Rol', 'Acción', 'Motivo'],
      filas: bs.map((b) => [
        fechaHora(b.fecha),
        b.quienNombre,
        b.rol.toUpperCase(),
        b.detalle,
        b.motivo ?? '',
      ]),
      anchos: [17, 24, 8, 70, 40],
    },
  ];
}

async function firmasPng(uids: string[], ctx: Contexto): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (const uid of new Set(uids)) {
    const f = ctx.usuarios.get(uid)?.firma;
    if (!f) continue;
    const png = await firmaAPng(f, 300, 75);
    if (png) m.set(uid, png);
  }
  return m;
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function nombreArchivo(p: ParametrosReporte, ctx: Contexto): string {
  const base =
    p.tipo === 'guardia' && p.uidGuardia
      ? (ctx.usuarios.get(p.uidGuardia)?.apellidos ?? 'guardia')
      : (p.cdId ?? 'todos');
  const limpio = `${p.tipo}_${base}_${p.desde}_${p.hasta}`.normalize('NFD').replace(/[^\w-]+/g, '_');
  return `${limpio}.${p.formato === 'Excel' ? 'xlsx' : 'pdf'}`;
}

export function tituloReporte(p: ParametrosReporte, ctx: Contexto): string {
  const quien =
    p.tipo === 'guardia' && p.uidGuardia
      ? (() => {
          const u = ctx.usuarios.get(p.uidGuardia!);
          return u ? `${u.nombre} ${u.apellidos}` : 'Guardia';
        })()
      : p.cdId
        ? cdTxt(ctx, p.cdId)
        : 'Todos los CD';
  return `${TIPOS_REPORTE[p.tipo]} · ${quien}`;
}

/** Genera y descarga el archivo. Devuelve la cantidad de filas. */
export async function generarReporte(p: ParametrosReporte, ctx: Contexto): Promise<number> {
  const tablas = await construirTablas(p, ctx);
  const principal = tablas[0]!;
  const firmas =
    principal.colFirma != null ? await firmasPng(principal.uidsFila ?? [], ctx) : new Map<string, string>();
  const titulo = tituloReporte(p, ctx);
  const rango = `Del ${fechaCorta(p.desde)} al ${fechaCorta(p.hasta)}`;
  if (p.formato === 'Excel') await excel(tablas, firmas, titulo, rango, ctx, nombreArchivo(p, ctx));
  else await pdf(principal, firmas, titulo, rango, ctx, nombreArchivo(p, ctx));
  return principal.filas.length;
}

async function excel(
  tablas: Tabla[],
  firmas: Map<string, string>,
  titulo: string,
  rango: string,
  ctx: Contexto,
  archivo: string,
) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = ctx.nombreApp;
  wb.created = new Date();
  for (const t of tablas) {
    const ws = wb.addWorksheet(t.titulo, {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    ws.mergeCells(1, 1, 1, t.columnas.length);
    ws.getCell(1, 1).value = `${ctx.nombreApp} · ${titulo}`;
    ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF041E42' } };
    ws.mergeCells(2, 1, 2, t.columnas.length);
    ws.getCell(2, 1).value =
      `${rango} · Generado por ${ctx.generadoPor} el ${fechaHora(new Date())} (hora de El Salvador)`;
    ws.getCell(2, 1).font = { size: 10, color: { argb: 'FF54627A' } };
    const enc = ws.getRow(4);
    t.columnas.forEach((c, i) => {
      const cell = enc.getCell(i + 1);
      cell.value = c;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0071CE' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF004F9A' } } };
    });
    enc.height = 22;
    ws.views = [{ state: 'frozen', ySplit: 4 }];
    t.filas.forEach((f, idx) => {
      const row = ws.getRow(5 + idx);
      f.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E7EF' } } };
        if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F6FA' } };
      });
      if (t.colFirma != null) {
        row.height = 36;
        const png = firmas.get(t.uidsFila?.[idx] ?? '');
        if (png) {
          const id = wb.addImage({ base64: png, extension: 'png' });
          ws.addImage(id, {
            tl: { col: t.colFirma + 0.05, row: 4 + idx + 0.08 },
            ext: { width: 150, height: 38 },
          });
        }
      }
    });
    (t.anchos ?? t.columnas.map(() => 16)).forEach((w, i) => (ws.getColumn(i + 1).width = w));
    if (!t.filas.length) ws.getCell(5, 1).value = 'Sin datos en el rango elegido.';
  }
  const buf = await wb.xlsx.writeBuffer();
  descargar(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    archivo,
  );
}

async function pdf(
  t: Tabla,
  firmas: Map<string, string>,
  titulo: string,
  rango: string,
  ctx: Contexto,
  archivo: string,
) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(4, 30, 66);
  doc.text(`${ctx.nombreApp} · ${titulo}`, 36, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(84, 98, 122);
  doc.text(
    `${rango} · Generado por ${ctx.generadoPor} el ${fechaHora(new Date())} (hora de El Salvador)`,
    36,
    56,
  );
  autoTable(doc, {
    startY: 70,
    head: [t.columnas],
    body: t.filas.length
      ? t.filas.map((f) => f.map(String))
      : [[{ content: 'Sin datos en el rango elegido.', colSpan: t.columnas.length }]],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4, valign: 'middle', lineColor: [226, 231, 239] },
    headStyles: { fillColor: [0, 113, 206], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 246, 250] },
    bodyStyles: t.colFirma != null ? { minCellHeight: 30 } : undefined,
    columnStyles: t.colFirma != null ? { [t.colFirma]: { cellWidth: 120 } } : undefined,
    didDrawCell: (d) => {
      if (t.colFirma == null || d.section !== 'body' || d.column.index !== t.colFirma) return;
      const png = firmas.get(t.uidsFila?.[d.row.index] ?? '');
      if (png)
        doc.addImage(
          png,
          'PNG',
          d.cell.x + 4,
          d.cell.y + 3,
          Math.min(112, d.cell.width - 8),
          d.cell.height - 6,
        );
    },
    didDrawPage: () => {
      const n = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(84, 98, 122);
      doc.text(`Página ${n}`, doc.internal.pageSize.getWidth() - 70, doc.internal.pageSize.getHeight() - 20);
    },
  });
  descargar(doc.output('blob'), archivo);
}
