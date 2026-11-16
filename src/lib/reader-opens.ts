import { movementTimestampMs, resolveClickSource, type ClickSource } from '@/lib/movement-display';

export type ReaderOpen = {
  /** Momento de la apertura (ISO). */
  at: string;
  /** Por dónde entró al lector, según lo que registró Notificas. 'unknown' si no se pudo determinar. */
  source: ClickSource;
};

type MovementLike = { type?: unknown; timestamp?: unknown; clickSource?: unknown; source?: unknown };

/**
 * Aperturas del lector de un envío, de la más antigua a la más reciente.
 * Se toman solo los movimientos `reader_magic_open` guardados al abrirse; el origen es el que quedó registrado
 * en ese momento y no se vuelve a deducir acá.
 */
export function readerOpensFromMovements(movements: unknown): ReaderOpen[] {
  if (!Array.isArray(movements)) return [];
  const out: Array<ReaderOpen & { ms: number }> = [];
  for (const raw of movements as MovementLike[]) {
    if (!raw || typeof raw !== 'object' || raw.type !== 'reader_magic_open') continue;
    const ms = movementTimestampMs(raw.timestamp);
    if (!ms) continue;
    out.push({
      ms,
      at: new Date(ms).toISOString(),
      source: resolveClickSource({
        type: 'reader_magic_open',
        clickSource: typeof raw.clickSource === 'string' ? raw.clickSource : undefined,
        source: typeof raw.source === 'string' ? raw.source : undefined,
      }),
    });
  }
  return out.sort((a, b) => a.ms - b.ms).map(({ at, source }) => ({ at, source }));
}

/** Rótulo de la fila de la cronología: dice solo lo que el registro sabe del origen. */
export function readerOpenRowLabel(source: ClickSource): string {
  if (source === 'correo') return 'Lector abierto desde el correo';
  if (source === 'whatsapp') return 'Lector abierto desde WhatsApp';
  return 'Lector abierto (origen no determinado)';
}
