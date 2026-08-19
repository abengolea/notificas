import type { CanalCampaign, RecipientEntry } from '@/lib/types';

const PHONE_E164_RE = /^\+\d{10,15}$/;
const CSV_SEPARATOR_ERROR =
  'El archivo usa punto y coma (;) como separador. Guardalo como CSV con coma (,) desde Excel: Archivo → Guardar como → CSV UTF-8 (delimitado por comas).';

export function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-().]/g, '');
}

export function phoneDigits(raw: string | undefined): string {
  return (raw || '').replace(/\D/g, '');
}

/**
 * Normaliza un teléfono argentino a E.164 con `+` (ej. +5491112345678).
 *
 * SYNC: la lógica de dígitos DEBE mantenerse igual a `formatPhoneForWhatsApp`
 * en functions/index.js (allá se guarda sin `+`; acá con `+` para el CSV/UI).
 * Si cambia una, cambiar la otra. Plan futuro: extraer a un paquete compartido
 * (hoy Next.js y Cloud Functions no comparten módulos).
 */
export function toWhatsAppPhone(raw: string): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  let digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return undefined;
  if (digits.startsWith('0')) digits = digits.slice(1);
  let result: string;
  if (digits.startsWith('54')) {
    if (digits.startsWith('549') && digits.length >= 12) result = digits;
    else if (digits[2] === '9') result = digits;
    else result = '549' + digits.slice(2);
  } else if (digits.startsWith('9') && digits.length === 11) {
    result = '54' + digits;
  } else {
    result = '549' + digits;
  }
  if (result.length < 10) return undefined;
  const e164 = `+${result}`;
  return PHONE_E164_RE.test(e164) ? e164 : undefined;
}

export function isSyntheticCampaignEmail(email: string | undefined): boolean {
  const e = (email || '').trim().toLowerCase();
  return !e || e.endsWith('@wa.internal') || e.endsWith('@notificas.internal');
}

export function detectCsvSeparatorError(headerLine: string): string | null {
  const commaCols = headerLine.split(',').map((c) => c.trim()).filter(Boolean);
  if (commaCols.length >= 2) return null;
  const semiCols = headerLine.split(';').map((c) => c.trim()).filter(Boolean);
  if (semiCols.length >= 2) return CSV_SEPARATOR_ERROR;
  return null;
}

const CSV_SAMPLE_CELL: Record<string, string> = {
  nombre: 'Juan García',
  email: 'juan@ejemplo.com',
  telefono: '+5491112345678',
  dni: '30123456',
  legajo: 'GCL-00001',
  dias: '180',
  fecha: '14/02/26',
  monto: '130000',
  cuotas: '7',
  area: 'Legales',
};

export function csvBaseColumns(canal: CanalCampaign): string[] {
  if (canal === 'whatsapp') return ['telefono', 'nombre', 'dni'];
  if (canal === 'ambos') return ['telefono', 'nombre', 'email', 'dni'];
  return ['nombre', 'email', 'dni'];
}

/** Columnas de destino/identidad. No son {{N}} del cuerpo de Meta (salvo que el mapeo las reuse). */
export function csvContactColumns(canal: CanalCampaign): string[] {
  return csvBaseColumns(canal);
}

export function csvHeaderColumns(canal: CanalCampaign, extraColumns: string[] = []): string[] {
  const base = csvBaseColumns(canal);
  const extras = extraColumns
    .map((c) => String(c || '').trim().toLowerCase())
    .filter((c) => c && !base.includes(c));
  const unique: string[] = [];
  for (const c of extras) {
    if (!unique.includes(c)) unique.push(c);
  }
  return [...base, ...unique];
}

export function csvPlaceholder(canal: CanalCampaign, extraColumns: string[] = []): string {
  const headers = csvHeaderColumns(canal, extraColumns);
  const row = headers.map((h) => CSV_SAMPLE_CELL[h] || 'valor');
  return `${headers.join(',')}\n${row.join(',')}`;
}

export function csvCamposRequeridos(canal: CanalCampaign, extraColumns: string[] = []): string {
  return csvHeaderColumns(canal, extraColumns).join(', ');
}

export type CsvColumnIndex = {
  iNombre: number;
  iEmail: number;
  iTelefono: number;
  iDni: number;
  iLegajo: number;
  iDias: number;
  iFecha: number;
  iMonto: number;
  iCuotas: number;
};

function csvHeaderCells(headerLine: string): string[] {
  return headerLine.split(',').map((h) =>
    h
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .replace(/^"|"$/g, '')
  );
}

export function parseCsvHeaderLine(headerLine: string, canal: CanalCampaign): CsvColumnIndex | null {
  const headers = csvHeaderCells(headerLine);
  const iNombre = headers.indexOf('nombre');
  const iEmail = headers.indexOf('email');
  const iTelefono = headers.indexOf('telefono');
  const iDni = headers.indexOf('dni');
  const iLegajo = headers.indexOf('legajo');
  const iDias = headers.includes('dias_atraso')
    ? headers.indexOf('dias_atraso')
    : headers.indexOf('dias');
  const iFecha = headers.indexOf('fecha');
  const iMonto = headers.indexOf('monto');
  const iCuotas = headers.indexOf('cuotas');
  const needEmail = canal === 'email' || canal === 'ambos';
  const needPhone = canal === 'whatsapp' || canal === 'ambos';
  if (iNombre < 0) return null;
  if (needEmail && iEmail < 0) return null;
  if (needPhone && iTelefono < 0) return null;
  if (iDni < 0) return null;
  return { iNombre, iEmail, iTelefono, iDni, iLegajo, iDias, iFecha, iMonto, iCuotas };
}

export function missingCsvTemplateColumns(headerLine: string, extraColumns: string[] = []): string[] {
  const headers = csvHeaderCells(headerLine);
  return extraColumns.filter((raw) => {
    const c = String(raw || '').trim().toLowerCase();
    if (!c) return false;
    if (c === 'dias') return !headers.includes('dias') && !headers.includes('dias_atraso');
    return !headers.includes(c);
  });
}

function csvMissingExtrasError(headerLine: string, canal: CanalCampaign, extraColumns: string[]): string | null {
  const missing = missingCsvTemplateColumns(headerLine, extraColumns);
  if (!missing.length) return null;
  return `Al CSV le faltan columnas del template: ${missing.join(', ')}. Encabezado esperado: ${csvCamposRequeridos(canal, extraColumns)}`;
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
  const telefono = rawPhone ? toWhatsAppPhone(rawPhone) : undefined;
  const dni = cols.iDni >= 0 ? cells[cols.iDni] || undefined : undefined;
  const legajo = cols.iLegajo >= 0 ? cells[cols.iLegajo] || undefined : undefined;
  const dias = cols.iDias >= 0 ? cells[cols.iDias] || undefined : undefined;
  const fecha = cols.iFecha >= 0 ? cells[cols.iFecha] || undefined : undefined;
  const monto = cols.iMonto >= 0 ? cells[cols.iMonto] || undefined : undefined;
  const cuotas = cols.iCuotas >= 0 ? cells[cols.iCuotas] || undefined : undefined;
  const needEmail = canal === 'email' || canal === 'ambos';
  const needPhone = canal === 'whatsapp' || canal === 'ambos';
  if (!nombre || !dni) return null;
  if (needEmail && !email.includes('@')) return null;
  if (needPhone && !telefono) return null;
  return {
    email,
    nombre,
    telefono,
    dni,
    legajo,
    ...(dias ? { dias } : {}),
    ...(fecha ? { fecha } : {}),
    ...(monto ? { monto } : {}),
    ...(cuotas ? { cuotas } : {}),
  };
}

export function dedupeRecipientsForCanal(
  rows: RecipientEntry[],
  canal: CanalCampaign
): { rows: RecipientEntry[]; phoneDuplicates: number } {
  const needPhone = canal === 'whatsapp' || canal === 'ambos';
  if (!needPhone) return { rows, phoneDuplicates: 0 };
  const seen = new Set<string>();
  const out: RecipientEntry[] = [];
  let phoneDuplicates = 0;
  for (const row of rows) {
    const key = phoneDigits(row.telefono);
    if (!key) {
      out.push(row);
      continue;
    }
    if (seen.has(key)) {
      phoneDuplicates += 1;
      continue;
    }
    seen.add(key);
    out.push(row);
  }
  return { rows: out, phoneDuplicates };
}

export type CsvInspectResult = {
  error: string | null;
  count: number;
  skipped: number;
  sample: string[];
};

/** Recorre el CSV y cuenta filas válidas sin armar el array completo. */
export async function inspectCampaignCsv(
  file: File,
  canal: CanalCampaign,
  extraColumns: string[] = []
): Promise<CsvInspectResult> {
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  const headerLine = lines.find((l) => l.trim()) || '';
  const sepErr = detectCsvSeparatorError(headerLine);
  if (sepErr) {
    return { error: sepErr, count: 0, skipped: 0, sample: [] };
  }
  const cols = parseCsvHeaderLine(headerLine, canal);
  if (!cols) {
    return {
      error: `CSV inválido. Campos requeridos: ${csvCamposRequeridos(canal, extraColumns)}`,
      count: 0,
      skipped: 0,
      sample: [],
    };
  }
  const extrasErr = csvMissingExtrasError(headerLine, canal, extraColumns);
  if (extrasErr) {
    return { error: extrasErr, count: 0, skipped: 0, sample: [] };
  }
  const needPhone = canal === 'whatsapp' || canal === 'ambos';
  const seenPhones = new Set<string>();
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
    if (needPhone) {
      const key = phoneDigits(row.telefono);
      if (key && seenPhones.has(key)) {
        skipped += 1;
        continue;
      }
      if (key) seenPhones.add(key);
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

export type ParseCsvQuickResult = {
  rows: RecipientEntry[];
  phoneDuplicates: number;
  error: string | null;
};

export function parseCsvQuickResult(
  text: string,
  canal: CanalCampaign,
  extraColumns: string[] = []
): ParseCsvQuickResult {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { rows: [], phoneDuplicates: 0, error: null };
  const sepErr = detectCsvSeparatorError(lines[0]);
  if (sepErr) return { rows: [], phoneDuplicates: 0, error: sepErr };
  const cols = parseCsvHeaderLine(lines[0], canal);
  if (!cols) {
    return {
      rows: [],
      phoneDuplicates: 0,
      error: `CSV inválido. Campos requeridos: ${csvCamposRequeridos(canal, extraColumns)}`,
    };
  }
  const extrasErr = csvMissingExtrasError(lines[0], canal, extraColumns);
  if (extrasErr) return { rows: [], phoneDuplicates: 0, error: extrasErr };
  const out: RecipientEntry[] = [];
  for (let r = 1; r < lines.length; r++) {
    const row = parseCsvDataLine(lines[r], cols, canal, r);
    if (row) out.push(row);
  }
  const deduped = dedupeRecipientsForCanal(out, canal);
  return { rows: deduped.rows, phoneDuplicates: deduped.phoneDuplicates, error: null };
}

/** Parsea un CSV completo (listas chicas). Para 150k usar inspect + upload por chunks. */
export function parseCsvQuick(text: string, canal: CanalCampaign): RecipientEntry[] {
  return parseCsvQuickResult(text, canal).rows;
}
