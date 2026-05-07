import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPanelConfig,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

function serializeFirestoreValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "object" && v !== null && "toDate" in v && typeof (v as { toDate: unknown }).toDate === "function") {
    try {
      return (v as Timestamp).toDate().toISOString();
    } catch {
      /* omit */
    }
  }
  if (Array.isArray(v)) return v.map(serializeFirestoreValue);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(o)) {
      out[k] = serializeFirestoreValue(val);
    }
    return out;
  }
  return v;
}

export async function GET(request: NextRequest) {
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

  try {
    const db = getAdminDb();
    const snap = await db
      .collection("mail")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const tickets = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(serializeFirestoreValue(docSnap.data()) as Record<string, unknown>),
    }));

    return NextResponse.json({ tickets });
  } catch (e) {
    console.error("[admin/mail-tickets]", e);
    return NextResponse.json({ error: "No se pudo leer Firestore" }, { status: 500 });
  }
}
