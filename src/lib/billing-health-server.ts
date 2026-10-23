import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { emptyInvoiceCounts, normalizeAdminInvoiceStatus } from "@/lib/admin-invoice-status";
import {
  billingHealthFingerprint,
  evaluateBillingHealth,
  type BillingHealthChecks,
  type BillingHealthSnapshot,
} from "@/lib/billing-health";
import { createMailDocumentAdmin } from "@/lib/email-server";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  DEFAULT_CONTACT_FROM_EMAIL,
  getBillingHealthNotifyEmail,
} from "@/lib/mail-defaults";
import {
  billingSharedSecret,
  hubBillingBaseUrl,
  hubBillingHealthUrl,
  isHubBillingConfigured,
  isHubInvoiceEmitEnabled,
} from "@/lib/notificas-hub-billing";
import { invokeSendEmail } from "@/lib/send-mail-via-cf";

const HEALTH_COLLECTION = "billing_health";
const LATEST_DOC = "latest";
const PING_TIMEOUT_MS = 8000;

function asString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function toIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sameCalendarDay(a: string, b: Date): boolean {
  const left = new Date(a);
  if (Number.isNaN(left.getTime())) return false;
  return (
    left.getFullYear() === b.getFullYear() &&
    left.getMonth() === b.getMonth() &&
    left.getDate() === b.getDate()
  );
}

function snapshotFromDoc(data: Record<string, unknown>): BillingHealthSnapshot {
  const counts = (data.counts24h ?? {}) as Record<string, unknown>;
  const checks = (data.checks ?? {}) as Record<string, unknown>;
  const problems = Array.isArray(data.problems)
    ? data.problems.map((item) => String(item)).filter(Boolean)
    : [];
  const level = data.level === "ok" || data.level === "warn" || data.level === "fail" ? data.level : "fail";
  return {
    checkedAt: toIso(data.checkedAt) ?? new Date(0).toISOString(),
    level,
    ok: data.ok === true || level === "ok",
    checks: {
      emitEnabled: checks.emitEnabled === true,
      hubConfigured: checks.hubConfigured === true,
      hubReachable: checks.hubReachable === true,
      hubHttpStatus: typeof checks.hubHttpStatus === "number" ? checks.hubHttpStatus : null,
      hubError: asString(checks.hubError),
    },
    counts24h: {
      issued: typeof counts.issued === "number" ? counts.issued : 0,
      pending: typeof counts.pending === "number" ? counts.pending : 0,
      failed: typeof counts.failed === "number" ? counts.failed : 0,
      none: typeof counts.none === "number" ? counts.none : 0,
      total: typeof counts.total === "number" ? counts.total : 0,
    },
    problems,
    alertSent: data.alertSent === true,
  };
}

async function countPurchasesLast24h() {
  const db = getAdminDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const counts = emptyInvoiceCounts();

  let docs;
  try {
    const snap = await db
      .collection("user_transactions")
      .where("fecha", ">=", Timestamp.fromDate(since))
      .get();
    docs = snap.docs;
  } catch {
    const snap = await db.collection("user_transactions").limit(800).get();
    docs = snap.docs;
  }

  for (const doc of docs) {
    const data = doc.data() as Record<string, unknown>;
    if (String(data.tipo ?? "") !== "compra") continue;
    if (!asString(data.paymentId) && !data.billingHub) continue;
    const fecha = toIso(data.fecha);
    if (!fecha || new Date(fecha).getTime() < since.getTime()) continue;
    const status = normalizeAdminInvoiceStatus(data.billingHub);
    counts[status] += 1;
    counts.total += 1;
  }

  return counts;
}

async function pingHub(): Promise<Pick<BillingHealthChecks, "hubReachable" | "hubHttpStatus" | "hubError">> {
  const url = hubBillingHealthUrl() || hubBillingBaseUrl();
  if (!url) {
    return { hubReachable: false, hubHttpStatus: null, hubError: "No hay URL de health del Hub" };
  }

  const secret = billingSharedSecret();
  const headers: Record<string, string> = {};
  if (secret) headers.Authorization = `Bearer ${secret}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    if (response.status === 401 || response.status === 403) {
      return {
        hubReachable: true,
        hubHttpStatus: response.status,
        hubError: `Hub rechazó el secret (HTTP ${response.status})`,
      };
    }
    if (response.status >= 500) {
      return {
        hubReachable: false,
        hubHttpStatus: response.status,
        hubError: `Hub respondió HTTP ${response.status}`,
      };
    }
    return { hubReachable: true, hubHttpStatus: response.status, hubError: null };
  } catch (error) {
    return {
      hubReachable: false,
      hubHttpStatus: null,
      hubError: error instanceof Error ? error.message : "No se pudo contactar al Hub",
    };
  }
}

async function notifyBillingHealthFail(snapshot: BillingHealthSnapshot): Promise<boolean> {
  const to = getBillingHealthNotifyEmail();
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://notificas.com.ar").replace(/\/$/, "");
  const adminUrl = `${base}/admin/facturas`;
  const problemsHtml = snapshot.problems.map((problem) => `<li>${escapeHtml(problem)}</li>`).join("");
  const html = [
    `<p>El chequeo diario de facturación de Notificas <strong>falló</strong>.</p>`,
    `<ul>${problemsHtml}</ul>`,
    `<p>Últimas 24 h: ${snapshot.counts24h.issued} emitidas, ${snapshot.counts24h.pending} pendientes, ${snapshot.counts24h.failed} fallidas, ${snapshot.counts24h.none} sin intento.</p>`,
    `<p>No se emitió ninguna factura de prueba. Revisá el panel:</p>`,
    `<p><a href="${escapeHtml(adminUrl)}">${escapeHtml(adminUrl)}</a></p>`,
  ].join("\n");
  const text = [
    "El chequeo diario de facturación de Notificas falló.",
    ...snapshot.problems,
    `Últimas 24 h: ${snapshot.counts24h.issued} emitidas, ${snapshot.counts24h.pending} pendientes, ${snapshot.counts24h.failed} fallidas, ${snapshot.counts24h.none} sin intento.`,
    `Panel: ${adminUrl}`,
  ].join("\n");

  const docId = await createMailDocumentAdmin({
    to,
    from: DEFAULT_CONTACT_FROM_EMAIL,
    replyTo: DEFAULT_CONTACT_FROM_EMAIL,
    subject: "[Facturación] Chequeo diario falló",
    html,
    text,
    senderName: "Notificas",
    recipientName: "Admin Notificas",
    recipientEmail: to,
    createdBy: "billing-health",
    contactRequest: true,
  });

  const sent = await invokeSendEmail(docId);
  if (!sent.ok) {
    console.error("billing-health: no se pudo enviar el aviso", sent.error);
    return false;
  }
  return true;
}

export async function getLatestBillingHealth(): Promise<BillingHealthSnapshot | null> {
  const db = getAdminDb();
  const snap = await db.collection(HEALTH_COLLECTION).doc(LATEST_DOC).get();
  if (!snap.exists) return null;
  return snapshotFromDoc(snap.data() as Record<string, unknown>);
}

export async function runBillingHealthCheck(): Promise<BillingHealthSnapshot> {
  const emitEnabled = isHubInvoiceEmitEnabled();
  const hubConfigured = isHubBillingConfigured();
  const ping = hubConfigured
    ? await pingHub()
    : { hubReachable: false, hubHttpStatus: null, hubError: null };
  const counts24h = await countPurchasesLast24h();
  const checks: BillingHealthChecks = {
    emitEnabled,
    hubConfigured,
    hubReachable: ping.hubReachable,
    hubHttpStatus: ping.hubHttpStatus,
    hubError: ping.hubError,
  };
  const evaluated = evaluateBillingHealth({ checks, counts24h });
  const previous = await getLatestBillingHealth();
  const nextFingerprint = billingHealthFingerprint(evaluated);
  const alreadyAlertedToday =
    previous?.alertSent === true &&
    previous.level === "fail" &&
    sameCalendarDay(previous.checkedAt, new Date()) &&
    billingHealthFingerprint(previous) === nextFingerprint;

  let alertSent = false;
  if (evaluated.level === "fail" && !alreadyAlertedToday) {
    try {
      alertSent = await notifyBillingHealthFail({
        checkedAt: new Date().toISOString(),
        level: evaluated.level,
        ok: false,
        checks,
        counts24h,
        problems: evaluated.problems,
        alertSent: false,
      });
    } catch (error) {
      console.error("billing-health: fallo enviando aviso", error);
    }
  }

  const snapshot: BillingHealthSnapshot = {
    checkedAt: new Date().toISOString(),
    level: evaluated.level,
    ok: evaluated.level === "ok",
    checks,
    counts24h,
    problems: evaluated.problems,
    alertSent: evaluated.level === "fail" && (alertSent || alreadyAlertedToday),
  };

  const db = getAdminDb();
  await db.collection(HEALTH_COLLECTION).doc(LATEST_DOC).set({
    ...snapshot,
    checkedAt: FieldValue.serverTimestamp(),
    fingerprint: nextFingerprint,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return snapshot;
}
