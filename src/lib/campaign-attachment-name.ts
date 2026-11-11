/**
 * Adjunto por columna del CSV: cada fila trae el nombre exacto de su archivo en la columna `adjunto`.
 * Acá vive lo que comparten el navegador (vista previa), el servidor (informe y control de envío)
 * y el worker (buscar el archivo de cada mensaje). Sin dependencias de Node.
 */

/** Columna del CSV que lleva el nombre del archivo de cada destinatario. */
export const CSV_ATTACHMENT_COLUMN = 'adjunto';

/** Normaliza un nombre de archivo para compararlo: sin carpetas, sin espacios en los bordes, sin mayúsculas. */
export function normalizeAttachmentName(raw: string | undefined | null): string {
  const base = String(raw ?? '').split(/[\\/]/).pop() ?? '';
  return base.normalize('NFC').trim().toLowerCase();
}

export interface AttachmentReport {
  /** Filas del CSV. */
  totalRows: number;
  /** Filas que tienen un nombre en la columna `adjunto`. */
  rowsWithName: number;
  /** Filas sin nombre de archivo. */
  rowsWithoutName: number;
  /** Filas cuyo archivo todavía no se subió. */
  rowsMissingFile: number;
  /** Archivos subidos que ninguna fila usa. */
  unusedFiles: number;
  /** Nombres pedidos por el CSV que no están subidos (sin repetir, primeros `sampleSize`). */
  missingFileNames: string[];
  /** Archivos subidos que ninguna fila usa (primeros `sampleSize`). */
  unusedFileNames: string[];
  /** Nombres que aparecen en más de una fila: un mismo archivo para varias personas. */
  sharedFileNames: string[];
  /** true si se puede enviar sin dejar a nadie sin su archivo. */
  ok: boolean;
}

/**
 * Cruza los nombres que pide el CSV con los archivos subidos.
 * `fileNames` son los nombres originales de los archivos; se comparan normalizados.
 */
export function buildAttachmentReport(params: {
  rowNames: Array<string | undefined | null>;
  fileNames: string[];
  sampleSize?: number;
}): AttachmentReport {
  const sampleSize = params.sampleSize ?? 20;
  const fileKeys = new Map<string, string>();
  for (const name of params.fileNames) {
    const key = normalizeAttachmentName(name);
    if (key && !fileKeys.has(key)) fileKeys.set(key, name);
  }

  const requested = new Map<string, { display: string; rows: number }>();
  let rowsWithName = 0;
  let rowsWithoutName = 0;
  let rowsMissingFile = 0;
  for (const raw of params.rowNames) {
    const key = normalizeAttachmentName(raw);
    if (!key) {
      rowsWithoutName += 1;
      continue;
    }
    rowsWithName += 1;
    const seen = requested.get(key);
    if (seen) seen.rows += 1;
    else requested.set(key, { display: String(raw).trim(), rows: 1 });
    if (!fileKeys.has(key)) rowsMissingFile += 1;
  }

  const missingFileNames: string[] = [];
  const sharedFileNames: string[] = [];
  for (const [key, info] of requested) {
    if (!fileKeys.has(key) && missingFileNames.length < sampleSize) missingFileNames.push(info.display);
    if (info.rows > 1 && sharedFileNames.length < sampleSize) sharedFileNames.push(info.display);
  }

  let unusedFiles = 0;
  const unusedFileNames: string[] = [];
  for (const [key, display] of fileKeys) {
    if (requested.has(key)) continue;
    unusedFiles += 1;
    if (unusedFileNames.length < sampleSize) unusedFileNames.push(display);
  }

  return {
    totalRows: params.rowNames.length,
    rowsWithName,
    rowsWithoutName,
    rowsMissingFile,
    unusedFiles,
    missingFileNames,
    unusedFileNames,
    sharedFileNames,
    ok: params.rowNames.length > 0 && rowsWithoutName === 0 && rowsMissingFile === 0,
  };
}

/** Texto corto del problema principal del informe, o '' si está todo bien. */
export function describeAttachmentReportProblem(r: AttachmentReport): string {
  if (r.totalRows === 0) return 'La lista no tiene destinatarios.';
  if (r.rowsWithoutName > 0) {
    return `${r.rowsWithoutName} ${r.rowsWithoutName === 1 ? 'fila no tiene' : 'filas no tienen'} nombre de archivo en la columna «${CSV_ATTACHMENT_COLUMN}».`;
  }
  if (r.rowsMissingFile > 0) {
    return `Faltan los archivos de ${r.rowsMissingFile} ${r.rowsMissingFile === 1 ? 'destinatario' : 'destinatarios'}.`;
  }
  return '';
}
