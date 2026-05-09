import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPanelConfig,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

function assertAdmin(request: NextRequest): NextResponse | null {
  const cfg = getAdminPanelConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "Panel admin no configurado en el servidor (.env.local)." },
      { status: 503 },
    );
  }
  const raw = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw || !verifyAdminSessionToken(raw, cfg.secret, cfg.email)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return null;
}

/** Aplica `precio_nuevo = redondear(precio * (1 + percent/100))` a todos los documentos en `plans`. */
export async function POST(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  let body: { percent?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const pct =
    typeof body.percent === "number" ? body.percent : Number(body.percent);
  if (!Number.isFinite(pct) || pct < -90 || pct > 1000) {
    return NextResponse.json(
      { error: "Porcentaje inválido. Usá un número entre -90 y 1000." },
      { status: 400 },
    );
  }

  try {
    const db = getAdminDb();
    const snap = await db.collection("plans").get();
    if (snap.empty) {
      return NextResponse.json({
        ok: true,
        count: 0,
        changes: [] as Array<{ id: string; antes: number; despues: number }>,
      });
    }

    const batch = db.batch();
    const changes: Array<{ id: string; antes: number; despues: number }> = [];
    const factor = 1 + pct / 100;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const antes =
        typeof data.precio === "number"
          ? data.precio
          : typeof data.precio === "string"
            ? Number(data.precio.replace(",", "."))
            : NaN;
      if (!Number.isFinite(antes) || antes < 0) continue;

      const raw = antes * factor;
      const despues = Math.round(Math.max(0, raw) * 100) / 100;

      batch.update(docSnap.ref, {
        precio: despues,
        updatedAt: FieldValue.serverTimestamp(),
      });
      changes.push({ id: docSnap.id, antes, despues });
    }

    if (changes.length === 0) {
      return NextResponse.json({
        ok: true,
        count: 0,
        changes: [],
        message: "Ningún plan tenía precio válido para ajustar.",
      });
    }

    await batch.commit();

    return NextResponse.json({ ok: true, count: changes.length, changes, percent: pct });
  } catch (e) {
    console.error("admin/plans/apply-percent", e);
    return NextResponse.json(
      { error: "Error al aplicar el ajuste masivo." },
      { status: 500 },
    );
  }
}
