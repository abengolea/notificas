/** Teléfono en el lote: identificable para el operador, no un padrón completo en un expediente. */
export function maskPhoneForLote(raw?: string | null): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 6) return "—";
  const last3 = digits.slice(-3);
  if (digits.startsWith("549") && digits.length >= 11) {
    const area = digits.slice(3, 6);
    return `+54 9 ${area} ***-*${last3}`;
  }
  if (digits.startsWith("54") && digits.length >= 10) {
    return `+54 ***${last3}`;
  }
  return `***${last3}`;
}
