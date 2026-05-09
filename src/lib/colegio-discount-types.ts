/** Tipos compartidos (cliente y servidor) para descuentos por colegio. */
export type ColegioCollegeRow = {
  id: string;
  nombreColegio: string;
  enabled: boolean;
  discountPercent: number;
  memberCount: number;
};

/**
 * Tras aplicar el % de descuento, el monto en ARS se baja al múltiplo de esta cifra (p. ej. 455 → 450, 643 → 640).
 */
export const COLEGIO_DESCUENTO_PISO_ARS = 10;