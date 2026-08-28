import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { timingSafeEqualText } from "@/lib/public-api/crypto";

function mailTrackingToken(data: FirebaseFirestore.DocumentData | undefined): string | null {
  if (!data) return null;
  const nested =
    data.tracking && typeof data.tracking.token === "string" ? data.tracking.token : null;
  if (nested) return nested;
  return typeof data.trackingToken === "string" ? data.trackingToken : null;
}

function paramsFrom(request: NextRequest): { mailId: string; token: string } {
  const mailId = (request.nextUrl.searchParams.get("m") || "").trim();
  const token = (request.nextUrl.searchParams.get("k") || "").trim();
  return { mailId, token };
}

function htmlPage(title: string, body: string, status = 200): NextResponse {
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: Inter, Segoe UI, sans-serif; background: #F8FAFC; color: #1E293B; margin: 0; padding: 48px 16px; }
    .card { max-width: 480px; margin: 0 auto; background: #fff; border: 1px solid #E2E8F0; border-radius: 8px; padding: 28px 24px; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    p { font-size: 15px; line-height: 1.6; margin: 0 0 10px; color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    ${body}
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function recordUnsubscribe(mailId: string, token: string, source: "one-click" | "link"): Promise<"ok" | "missing" | "bad_token"> {
  const db = getAdminDb();
  const ref = db.collection("mail").doc(mailId);
  const snap = await ref.get();
  if (!snap.exists) return "missing";
  const stored = mailTrackingToken(snap.data());
  if (!stored || !timingSafeEqualText(stored, token)) return "bad_token";

  const data = snap.data() || {};
  if (!data.listUnsubscribedAt) {
    await ref.update({
      listUnsubscribedAt: FieldValue.serverTimestamp(),
      listUnsubscribeSource: source,
    });
  }

  const rawTo = data.to;
  const email = String(
    data.recipientEmail ||
      (Array.isArray(rawTo) ? rawTo[0] : rawTo) ||
      ""
  )
    .trim()
    .toLowerCase();
  if (email.includes("@")) {
    const unsubRef = db.collection("email_unsubscribes").doc(email);
    const existing = await unsubRef.get();
    if (!existing.exists) {
      await unsubRef.set({
        email,
        mailId,
        campaignId: data.campaignId ? String(data.campaignId) : null,
        orgId: data.orgId ? String(data.orgId) : null,
        source,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
  return "ok";
}

/** RFC 8058: Outlook/Gmail envían POST One-Click. Debe responder 200. */
export async function POST(request: NextRequest) {
  const { mailId, token } = paramsFrom(request);
  if (mailId && token) {
    try {
      await recordUnsubscribe(mailId, token, "one-click");
    } catch (e) {
      console.error("list-unsubscribe POST:", e instanceof Error ? e.message : e);
    }
  }
  return new NextResponse(null, { status: 200 });
}

export async function GET(request: NextRequest) {
  const { mailId, token } = paramsFrom(request);
  if (!mailId || !token) {
    return htmlPage(
      "Enlace incompleto",
      "<p>Faltan datos para registrar la baja. Si llegó desde un correo de Notificas, use el enlace completo del mensaje.</p>",
      400
    );
  }
  try {
    const result = await recordUnsubscribe(mailId, token, "link");
    if (result === "ok") {
      return htmlPage(
        "Baja registrada",
        "<p>Registramos que no desea recibir más correos de campañas de Notificas en esta casilla.</p><p>Esto no anula constancias ya enviadas ni notificaciones que deba recibir por otras vías.</p>"
      );
    }
    if (result === "bad_token" || result === "missing") {
      return htmlPage(
        "Enlace no válido",
        "<p>Este enlace de baja no es válido o ya no corresponde a un mensaje activo.</p>",
        400
      );
    }
  } catch (e) {
    console.error("list-unsubscribe GET:", e instanceof Error ? e.message : e);
  }
  return htmlPage(
    "No se pudo completar",
    "<p>Intente de nuevo en unos minutos o escriba a contacto@notificas.com.</p>",
    500
  );
}
