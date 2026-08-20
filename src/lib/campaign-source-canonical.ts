/** Campos de una fila que entran en la huella de origen (CSV o lista JSON). */
export type SourceRowFields = {
  email?: string | null;
  nombre?: string | null;
  dni?: string | null;
  telefono?: string | null;
  monto?: string | null;
  cuotas?: string | null;
  fecha?: string | null;
  dias?: string | null;
  legajo?: string | null;
};

/** Evita que un valor rompa el payload pipe-delimited. */
export function pipeSafe(value: unknown): string {
  return String(value ?? '')
    .replace(/\|/g, '/')
    .replace(/\r|\n/g, ' ')
    .trim();
}

export function sourceRowCanonical(row: SourceRowFields): string {
  const email = pipeSafe(row.email).toLowerCase();
  const phone = pipeSafe(row.telefono).replace(/\D/g, '');
  const dni = pipeSafe(row.dni).replace(/\D/g, '');
  return [
    'ROW',
    'v1',
    dni,
    phone,
    email,
    pipeSafe(row.nombre),
    pipeSafe(row.monto),
    pipeSafe(row.cuotas),
    pipeSafe(row.fecha),
    pipeSafe(row.dias),
    pipeSafe(row.legajo),
  ].join('|');
}
