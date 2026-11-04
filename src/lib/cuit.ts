const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function cuitDigits(raw?: string | null): string {
  return String(raw || '').replace(/\D/g, '');
}

/** CUIT argentino de 11 dígitos con dígito verificador AFIP. */
export function isValidCuit(raw?: string | null): boolean {
  const d = cuitDigits(raw);
  if (!/^\d{11}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * WEIGHTS[i];
  const rest = sum % 11;
  const check = rest === 0 ? 0 : 11 - rest;
  if (check === 10) return false;
  return check === Number(d[10]);
}

/** `XX-XXXXXXXX-X` o null si el verificador no cierra. */
export function formatCuit(raw?: string | null): string | null {
  const d = cuitDigits(raw);
  if (!isValidCuit(d)) return null;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}
