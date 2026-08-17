import type { CanalCampaign, RecipientEntry } from '@/lib/types';

const PHONE_RE = /^\+?[\d\s\-().]{7,20}$/;

export function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-().]/g, '');
}

export function csvPlaceholder(canal: CanalCampaign): string {
  if (canal === 'whatsapp') return 'nombre,telefono,dni,legajo\nJuan García,+5491112345678,30123456,GCL-00001';
  if (canal === 'ambos') return 'nombre,email,telefono,dni,legajo\nJuan García,juan@ejemplo.com,+5491112345678,30123456,GCL-00001';
  return 'nombre,email,dni,legajo\nJuan García,juan@ejemplo.com,30123456,GCL-00001';
}

export function csvCamposRequeridos(canal: CanalCampaign): string {
  if (canal === 'whatsapp') return 'nombre, telefono, dni';
  if (canal === 'ambos') return 'nombre, email, telefono, dni';
  return 'nombre, email, dni';
}

export type CsvColumnIndex = {
  iNombre: number;
  iEmail: number;
  iTelefono: number;
  iDni: number;
  iLegajo: number;
};

export function parseCsvHeaderLine(headerLine: string, canal: CanalCampaign): CsvColumnIndex | null {
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const iNombre = headers.indexOf('nombre');
  const iEmail = headers.indexOf('email');
  const iTelefono = headers.indexOf('telefono');
  const iDni = headers.indexOf('dni');
  const iLegajo = headers.indexOf('legajo');
  const needEmail = canal === 'email' || canal === 'ambos';
  const needPhone = canal === 'whatsapp' || canal === 'ambos';
  if (iNombre < 0) return null;
  if (needEmail && iEmail < 0) return null;
  if (needPhone && iTelefono < 0) return null;
  if (iDni < 0) return null;
  return { iNombre, iEmail, iTelefono, iDni, iLegajo };
}

export function parseCsvDataLine(
  line: string,
  cols: CsvColumnIndex,
  canal: CanalCampaign,
  rowNumber: number
): RecipientEntry | null {
  const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  const nombre = cells[cols.iNombre] || '';
  const email = cols.iEmail >= 0 ? (cells[cols.iEmail] || '').toLowerCase() : `sin-email-${rowNumber}@wa.internal`;
  const rawPhone = cols.iTelefono >= 0 ? cells[cols.iTelefono] || undefined : undefined;
  const telefono = rawPhone ? normalizePhone(rawPhone) : undefined;
  const dni = cols.iDni >= 0 ? cells[cols.iDni] || undefined : undefined;
  const legajo = cols.iLegajo >= 0 ? cells[cols.iLegajo] || undefined : undefined;
  const needEmail = canal === 'email' || canal === 'ambos';
  const needPhone = canal === 'whatsapp' || canal === 'ambos';
  if (!nombre || !dni) return null;
  if (needEmail && !email.includes('@')) return null;
  if (needPhone && !telefono) return null;
  if (telefono && !PHONE_RE.test(rawPhone || '')) return null;
  return { email, nombre, telefono, dni, legajo };
}

export type CsvInspectResult = {
  error: string | null;
  count: number;
  skipped: number;
  sample: string[];
};

/** Recorre el CSV y cuenta filas válidas sin armar el array completo. */
export async function inspectCampaignCsv(file: File, canal: CanalCampaign): Promise<CsvInspectResult> {
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  const headerLine = lines.find((l) => l.trim()) || '';
  const cols = parseCsvHeaderLine(headerLine, canal);
  if (!cols) {
    return {
      error: `CSV inválido. Campos requeridos: ${csvCamposRequeridos(canal)}`,
      count: 0,
      skipped: 0,
      sample: [],
    };
  }
  let count = 0;
  let skipped = 0;
  const sample: string[] = [];
  for (let r = 1; r < lines.length; r++) {
    const line = lines[r];
    if (!line || !line.trim()) continue;
    const row = parseCsvDataLine(line, cols, canal, r);
    if (!row) {
      skipped += 1;
      continue;
    }
    count += 1;
    if (sample.length < 3) sample.push(row.nombre);
  }
  if (count === 0) {
    return {
      error: 'El archivo no contiene filas válidas. Revisá el formato y los campos obligatorios.',
      count: 0,
      skipped,
      sample: [],
    };
  }
  return { error: null, count, skipped, sample };
}

/** Parsea un CSV completo (listas chicas). Para 150k usar inspect + upload por chunks. */
export function parseCsvQuick(text: string, canal: CanalCampaign): RecipientEntry[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const cols = parseCsvHeaderLine(lines[0], canal);
  if (!cols) return [];
  const out: RecipientEntry[] = [];
  for (let r = 1; r < lines.length; r++) {
    const row = parseCsvDataLine(lines[r], cols, canal, r);
    if (row) out.push(row);
  }
  return out;
}
