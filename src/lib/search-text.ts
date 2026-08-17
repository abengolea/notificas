/** Normaliza texto para búsqueda: minúsculas y sin tildes. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function campaignMessageMatchesSearch(
  data: {
    recipientNombre?: unknown;
    recipientEmail?: unknown;
    recipientDni?: unknown;
    recipientLegajo?: unknown;
    recipientTelefono?: unknown;
  },
  rawQuery: string,
): boolean {
  const q = normalizeForSearch(rawQuery);
  if (!q) return true;
  const haystack = normalizeForSearch(
    [
      data.recipientNombre,
      data.recipientEmail,
      data.recipientDni,
      data.recipientLegajo,
      data.recipientTelefono,
    ]
      .filter((v) => v != null && String(v).trim())
      .join(' '),
  );
  return haystack.includes(q);
}
