import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-session";
import { verifyAuthToken } from "@/lib/auth-helper";
import { canViewMail } from "@/lib/verify-mail-access";
import { buildResendCommunicationReport, resolveResendMailId } from "@/lib/resend-evidence-verification";

const SECRET_KEY = /token|secret|authorization|password|cookie|bearer/i;

function stripSecrets<T>(value: T, depth = 0): T {
  if (depth > 10 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => stripSecrets(v, depth + 1)) as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) continue;
      out[k] = stripSecrets(v, depth + 1);
    }
    return out as T;
  }
  return value;
}

/**
 * Validación de comunicación email / Resend. Solo usuarios autenticados
 * con acceso al envío. Nunca expone RESEND_API_KEY ni el webhook secret.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = hasAdminSession(request);
    if (!admin) {
      const { errorResponse } = await verifyAuthToken(request);
      if (errorResponse) return errorResponse;
    }

    const body = await request.json().catch(() => ({}));
    const messageId = typeof body?.messageId === "string" ? body.messageId.trim() : "";
    const campaignId = typeof body?.campaignId === "string" ? body.campaignId.trim() : "";
    if (!messageId) {
      return NextResponse.json({ error: "messageId requerido" }, { status: 400 });
    }

    const mailId = await resolveResendMailId({ messageId, campaignId });
    if (!mailId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    const allowed = await canViewMail(request, mailId);
    if (!allowed) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const report = await buildResendCommunicationReport({ mailId });
    if (!report) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const sanitized = stripSecrets(report);
    const format = typeof body?.format === "string" ? body.format.trim().toLowerCase() : "";
    if (format === "pdf") {
      const { buildResendVerificationPdf } = await import("@/lib/resend-communication-pdf");
      const pdf = await buildResendVerificationPdf(sanitized);
      const fileName = `constancia-resend-${mailId}.pdf`;
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: sanitized });
  } catch (e) {
    console.error("POST /api/verify/resend", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
