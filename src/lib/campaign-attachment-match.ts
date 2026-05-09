import type { RecipientEntry } from '@/lib/types';

/** Normaliza texto para comparar archivo ↔ destinatario (acentos, puntuación). */
export function normalizeForMatch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export interface FileRecipientScore {
  score: number;
  label: 'alta' | 'media' | 'baja';
}

export function scoreFileForRecipient(fileName: string, recipient: RecipientEntry): FileRecipientScore {
  const stem = fileName.replace(/\.[^.]+$/u, '');
  const nStem = normalizeForMatch(stem);
  const nEmailFull = normalizeForMatch(recipient.email || '');
  const localPart = normalizeForMatch(recipient.email.split('@')[0] || '');
  const nNombre = normalizeForMatch(recipient.nombre || '');

  if (nStem && nEmailFull && (nStem === nEmailFull || nStem.includes(nEmailFull))) {
    return { score: 100, label: 'alta' };
  }

  if (nStem && localPart.length >= 3 && (nStem === localPart || nStem.includes(localPart))) {
    return { score: 88, label: 'alta' };
  }

  if (nNombre.length >= 3 && (nStem === nNombre || nStem.includes(nNombre))) {
    return { score: 82, label: 'alta' };
  }

  const tokens = (recipient.nombre || '')
    .split(/\s+/)
    .map((t) => normalizeForMatch(t))
    .filter((t) => t.length >= 2);
  if (tokens.length >= 2 && tokens.every((t) => nStem.includes(t))) {
    return { score: 76, label: 'media' };
  }
  if (tokens.length === 1 && tokens[0].length >= 3 && nStem.includes(tokens[0])) {
    return { score: 70, label: 'media' };
  }
  if (tokens.length >= 2) {
    const hits = tokens.filter((t) => t.length >= 3 && nStem.includes(t));
    if (hits.length >= 1) {
      return { score: 55, label: 'baja' };
    }
  }

  return { score: 0, label: 'baja' };
}

/** Asignación greedy 1 archivo ↔ 1 destinatario por mejor score (sin reutilizar archivos). */
export function assignFilesToRecipientsGreedy(
  fileNames: string[],
  recipients: RecipientEntry[],
  minScore = 40
): { emailToFileIndex: Record<string, number | null>; unassignedFileIndexes: number[] } {
  type Edge = { email: string; fileIdx: number; score: number };
  const edges: Edge[] = [];
  recipients.forEach((r) => {
    const email = r.email.trim().toLowerCase();
    fileNames.forEach((name, fileIdx) => {
      const { score } = scoreFileForRecipient(name, r);
      if (score >= minScore) {
        edges.push({ email, fileIdx, score });
      }
    });
  });

  edges.sort((a, b) => b.score - a.score);

  const emailToFileIndex: Record<string, number | null> = {};
  recipients.forEach((r) => {
    emailToFileIndex[r.email.trim().toLowerCase()] = null;
  });

  const usedFiles = new Set<number>();
  const usedEmails = new Set<string>();

  for (const e of edges) {
    if (usedEmails.has(e.email) || usedFiles.has(e.fileIdx)) continue;
    usedEmails.add(e.email);
    usedFiles.add(e.fileIdx);
    emailToFileIndex[e.email] = e.fileIdx;
  }

  const unassignedFileIndexes = fileNames
    .map((_, i) => i)
    .filter((i) => !usedFiles.has(i));

  return { emailToFileIndex, unassignedFileIndexes };
}
