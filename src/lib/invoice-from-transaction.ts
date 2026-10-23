import { buildInvoicePdfBuffer } from '@/lib/invoice-pdf';

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export function tryBuildInvoicePdfFromTransaction(
  tx: Record<string, unknown>
): { ok: true; pdf: Buffer; filename: string } | { ok: false; error: string; status: number } {
  const billingHub = (tx.billingHub ?? {}) as Record<string, unknown>;
  const cae = asString(billingHub.cae);
  if (billingHub.status !== 'issued' || !cae) {
    return { ok: false, error: 'La factura todavía no está disponible', status: 404 };
  }

  const pdf = buildInvoicePdfBuffer({
    tipoComprobante: asString(billingHub.tipoComprobante) ?? undefined,
    cbteTipo: asNumber(billingHub.cbteTipo) ?? undefined,
    puntoVenta: asNumber(billingHub.ptoVta) ?? undefined,
    numero: asNumber(billingHub.voucherNumber) ?? undefined,
    fecha: toDate(tx.fecha) ?? new Date(),
    cae,
    caeFchVto: asString(billingHub.caeFchVto),
    receptor: {
      razonSocial: asString(billingHub.buyerRazonSocial),
      cuit: asString(billingHub.buyerCuit),
      email: asString(billingHub.buyerEmail),
      domicilio: asString(billingHub.buyerDomicilio),
    },
    descripcion: asString(tx.descripcion),
    netoGravado: asNumber(billingHub.netoGravado),
    iva: asNumber(billingHub.iva),
    total: asNumber(billingHub.total) ?? asNumber(tx.monto),
  });

  const pv = String(asNumber(billingHub.ptoVta) ?? 0).padStart(5, '0');
  const nro = String(asNumber(billingHub.voucherNumber) ?? 0).padStart(8, '0');

  return {
    ok: true,
    pdf,
    filename: `factura-${pv}-${nro}.pdf`,
  };
}
