export const ADMIN_INVOICE_STATUSES = ["issued", "pending", "failed", "none"] as const;
export type AdminInvoiceStatus = (typeof ADMIN_INVOICE_STATUSES)[number];

export type AdminInvoiceCounts = Record<AdminInvoiceStatus, number> & { total: number };

export type AdminInvoiceRow = {
  id: string;
  fecha: string;
  userId: string;
  userEmail: string | null;
  userNombre: string | null;
  descripcion: string;
  monto: number;
  creditos: number;
  paymentId: string | null;
  status: AdminInvoiceStatus;
  facturaId: string | null;
  cae: string | null;
  voucherNumber: number | null;
  ptoVta: number | null;
  tipoComprobante: string | null;
  buyerRazonSocial: string | null;
  buyerCuit: string | null;
  buyerEmail: string | null;
  reason: string | null;
  error: string | null;
};

function asString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

export function normalizeAdminInvoiceStatus(billingHub: unknown): AdminInvoiceStatus {
  if (!billingHub || typeof billingHub !== "object") return "none";
  const status = asString((billingHub as { status?: unknown }).status)?.toLowerCase();
  if (status === "issued" || status === "pending" || status === "failed") return status;
  return "none";
}

export function adminInvoiceStatusLabel(status: AdminInvoiceStatus): string {
  switch (status) {
    case "issued":
      return "Emitida";
    case "pending":
      return "Pendiente";
    case "failed":
      return "No emitida";
    default:
      return "Sin intento";
  }
}

export function emptyInvoiceCounts(): AdminInvoiceCounts {
  return { issued: 0, pending: 0, failed: 0, none: 0, total: 0 };
}
