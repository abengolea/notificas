import { Timestamp } from "firebase-admin/firestore";
import {
  emptyInvoiceCounts,
  normalizeAdminInvoiceStatus,
  type AdminInvoiceCounts,
  type AdminInvoiceRow,
  type AdminInvoiceStatus,
} from "@/lib/admin-invoice-status";
import { getAdminDb } from "@/lib/firebase-admin";
import { requestHubInvoiceForMercadoPagoPayment } from "@/lib/notificas-hub-billing";

export type { AdminInvoiceCounts, AdminInvoiceRow, AdminInvoiceStatus };
export { adminInvoiceStatusLabel, emptyInvoiceCounts, normalizeAdminInvoiceStatus } from "@/lib/admin-invoice-status";

export type AdminInvoiceListResult = {
  invoices: AdminInvoiceRow[];
  counts: AdminInvoiceCounts;
  truncated: boolean;
};

const LIST_LIMIT = 400;
const SCAN_FALLBACK_LIMIT = 800;

function asString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

function isBillablePurchase(data: Record<string, unknown>): boolean {
  if (String(data.tipo ?? "") !== "compra") return false;
  return Boolean(asString(data.paymentId) || data.billingHub);
}

function mapInvoiceRow(id: string, data: Record<string, unknown>): AdminInvoiceRow {
  const billingHub = (data.billingHub ?? {}) as Record<string, unknown>;
  return {
    id,
    fecha: toIso(data.fecha),
    userId: asString(data.userId) ?? "",
    userEmail: null,
    userNombre: null,
    descripcion: asString(data.descripcion) ?? "",
    monto: asNumber(data.monto) ?? 0,
    creditos: asNumber(data.creditos) ?? 0,
    paymentId: asString(data.paymentId),
    status: normalizeAdminInvoiceStatus(data.billingHub),
    facturaId: asString(billingHub.facturaId),
    cae: asString(billingHub.cae),
    voucherNumber: asNumber(billingHub.voucherNumber),
    ptoVta: asNumber(billingHub.ptoVta),
    tipoComprobante: asString(billingHub.tipoComprobante),
    buyerRazonSocial: asString(billingHub.buyerRazonSocial),
    buyerCuit: asString(billingHub.buyerCuit),
    buyerEmail: asString(billingHub.buyerEmail),
    reason: asString(billingHub.reason),
    error: asString(billingHub.error),
  };
}

function rowMatchesQuery(row: AdminInvoiceRow, rawQuery: string): boolean {
  const q = rawQuery.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  if (!q) return true;
  const haystack = [
    row.userEmail,
    row.userNombre,
    row.descripcion,
    row.paymentId,
    row.facturaId,
    row.cae,
    row.buyerRazonSocial,
    row.buyerCuit,
    row.buyerEmail,
    row.id,
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

async function loadPurchaseDocs() {
  const db = getAdminDb();

  try {
    const snap = await db
      .collection("user_transactions")
      .where("tipo", "==", "compra")
      .orderBy("fecha", "desc")
      .limit(LIST_LIMIT)
      .get();
    return { docs: snap.docs, truncated: snap.size >= LIST_LIMIT };
  } catch {
    try {
      const snap = await db
        .collection("user_transactions")
        .where("tipo", "==", "compra")
        .limit(LIST_LIMIT)
        .get();
      return { docs: snap.docs, truncated: snap.size >= LIST_LIMIT };
    } catch {
      const snap = await db.collection("user_transactions").limit(SCAN_FALLBACK_LIMIT).get();
      return { docs: snap.docs, truncated: snap.size >= SCAN_FALLBACK_LIMIT };
    }
  }
}

async function attachUsers(rows: AdminInvoiceRow[]): Promise<AdminInvoiceRow[]> {
  const ids = [...new Set(rows.map((row) => row.userId).filter(Boolean))];
  if (ids.length === 0) return rows;

  const db = getAdminDb();
  const users = new Map<string, { email: string | null; nombre: string | null }>();

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const snaps = await db.getAll(...chunk.map((id) => db.collection("users").doc(id)));
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const data = snap.data() as Record<string, unknown>;
      const perfil = (data.perfil ?? {}) as Record<string, unknown>;
      const nombre =
        [asString(perfil.nombre), asString(perfil.apellido)].filter(Boolean).join(" ").trim() ||
        asString(perfil.razonSocial);
      users.set(snap.id, {
        email: asString(data.email),
        nombre: nombre || null,
      });
    }
  }

  return rows.map((row) => {
    const user = users.get(row.userId);
    return {
      ...row,
      userEmail: user?.email ?? row.buyerEmail ?? null,
      userNombre: row.buyerRazonSocial ?? user?.nombre ?? null,
    };
  });
}

export async function listAdminInvoices(opts?: {
  status?: AdminInvoiceStatus | "all";
  q?: string;
}): Promise<AdminInvoiceListResult> {
  const { docs, truncated } = await loadPurchaseDocs();
  const counts = emptyInvoiceCounts();

  const mapped = await attachUsers(
    docs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        if (!isBillablePurchase(data)) return null;
        return mapInvoiceRow(doc.id, data);
      })
      .filter((row): row is AdminInvoiceRow => row != null)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
  );

  for (const row of mapped) {
    counts.total += 1;
    counts[row.status] += 1;
  }

  const status = opts?.status && opts.status !== "all" ? opts.status : undefined;
  const q = opts?.q?.trim() ?? "";
  const invoices = mapped.filter((row) => {
    if (status && row.status !== status) return false;
    return rowMatchesQuery(row, q);
  });

  return {
    invoices,
    counts,
    truncated,
  };
}

export async function retryAdminInvoice(transactionId: string) {
  const id = transactionId.trim();
  if (!id || id.includes("/")) {
    return { ok: false as const, status: 400, error: "Transacción inválida" };
  }

  const db = getAdminDb();
  const snap = await db.collection("user_transactions").doc(id).get();
  if (!snap.exists) {
    return { ok: false as const, status: 404, error: "Compra no encontrada" };
  }

  const data = snap.data() as Record<string, unknown>;
  const paymentId = asString(data.paymentId);
  if (!paymentId) {
    return { ok: false as const, status: 400, error: "Esta compra no tiene paymentId de Mercado Pago" };
  }

  const billing = await requestHubInvoiceForMercadoPagoPayment(paymentId);
  if (billing.ok) {
    return {
      ok: true as const,
      alreadyIssued: billing.alreadyIssued === true,
      facturaId: billing.facturaId ?? null,
    };
  }

  if (billing.skipped) {
    return {
      ok: false as const,
      status: 409,
      error: billing.reason,
    };
  }

  return {
    ok: false as const,
    status: billing.status && billing.status >= 400 ? billing.status : 502,
    error: billing.error,
  };
}
