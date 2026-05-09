import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
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

function toIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (
    v &&
    typeof v === "object" &&
    "toDate" in v &&
    typeof (v as Timestamp).toDate === "function"
  ) {
    try {
      return (v as Timestamp).toDate().toISOString();
    } catch {
      /* fallthrough */
    }
  }
  if (v instanceof Date) return v.toISOString();
  return new Date(0).toISOString();
}

/** Lista usuarios desde Firestore `users/{uid}` (perfiles de la app). */
export async function GET(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  try {
    const db = getAdminDb();
    let snap;
    try {
      snap = await db.collection("users").orderBy("createdAt", "desc").limit(300).get();
    } catch {
      snap = await db.collection("users").limit(300).get();
    }

    const users = snap.docs.map((docSnap) => {
      const d = docSnap.data() as Record<string, unknown>;
      const perfil = (d.perfil || {}) as { nombre?: string };
      const estadoRaw = d.estado;
      const estado =
        estadoRaw === "suspendido" ? ("suspendido" as const) : ("activo" as const);
      const creditos = typeof d.creditos === "number" ? d.creditos : 0;

      return {
        id: docSnap.id,
        nombre: (typeof perfil.nombre === "string" && perfil.nombre.trim()) ? perfil.nombre.trim()
          : typeof d.email === "string" && d.email
            ? d.email
            : "Sin nombre",
        email: typeof d.email === "string" ? d.email : "",
        estado,
        enviosDisponibles: creditos,
        fechaRegistro: toIso(d.createdAt),
      };
    });

    users.sort((a, b) => new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime());

    return NextResponse.json({ users });
  } catch (e) {
    console.error("[admin/users GET]", e);
    return NextResponse.json({ error: "No se pudieron leer los usuarios" }, { status: 500 });
  }
}

/** Actualiza estado o suma créditos (envíos) en `users/{uid}`. */
export async function PATCH(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  let body: { uid?: string; estado?: string; addCreditos?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const uid = typeof body.uid === "string" ? body.uid.trim() : "";
  if (!uid) {
    return NextResponse.json({ error: "Falta uid" }, { status: 400 });
  }

  const estadoIn =
    body.estado === "activo" || body.estado === "suspendido" ? body.estado : undefined;
  const add =
    typeof body.addCreditos === "number" && Number.isFinite(body.addCreditos)
      ? Math.floor(body.addCreditos)
      : 0;

  if (!estadoIn && add <= 0) {
    return NextResponse.json(
      { error: "Indicá estado o addCreditos positivo" },
      { status: 400 },
    );
  }

  try {
    const db = getAdminDb();
    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (estadoIn) updates.estado = estadoIn;
    if (add > 0) updates.creditos = FieldValue.increment(add);

    await ref.update(updates);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/users PATCH]", e);
    return NextResponse.json({ error: "No se pudo actualizar el usuario" }, { status: 500 });
  }
}
