import { COLEGIO_DESCUENTO_PISO_ARS } from "@/lib/colegio-discount-types";

/** Debe coincidir con `COLEGIO_NOMBRE_DEFAULT` en servidor (fallback en la billetera). */
export const COLEGIO_NOMBRE_FALLBACK_CLIENT = "Colegio de abogados";

/** Igual que en servidor: % sobre lista, luego piso a múltiplos de {@link COLEGIO_DESCUENTO_PISO_ARS} ARS. */
export function clienteDescuentoLista(listPrice: number, discountPercent: number): number {
  if (!Number.isFinite(listPrice) || listPrice < 0) return 0;
  if (!Number.isFinite(discountPercent) || discountPercent <= 0) {
    return Math.round(listPrice * 100) / 100;
  }
  const step = COLEGIO_DESCUENTO_PISO_ARS;
  const factor = Math.min(100, Math.max(0, discountPercent)) / 100;
  const out = listPrice * (1 - factor);
  return Math.floor(Math.max(0, out) / step) * step;
}