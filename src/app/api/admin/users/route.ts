import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { listAdminUsersMerged } from "@/lib/admin-users-server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPanelConfig,
  verifyAdminSessionToken,
} from "@/lib/admin-session";
import { normalizeEnviosDisponibles } from "@/lib/envios";

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

/** Lista usuarios Notificas y/o nómina del colegio (LegalMev). ?filter=todos|colegio|solo_cuenta */
export async function GET(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const filterParam = request.nextUrl.searchParams.get("filter");
  const filter =
    filterParam === "colegio" || filterParam === "solo_cuenta" ? filterParam : "todos";
  const collegeId = request.nextUrl.searchParams.get("collegeId")?.trim() || undefined;

  try {
    const { users, colegioNombre } = await listAdminUsersMerged({ filter, collegeId });
    return NextResponse.json({ users, colegioNombre, filter });
  } catch (e) {
    console.error("[admin/users GET]", e);
    return NextResponse.json({ error: "No se pudieron leer los usuarios" }, { status: 500 });
  }
}

/** Actualiza estado o suma envíos disponibles en `users/{uid}`. */
export async function PATCH(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  let body: { uid?: string; estado?: string; addCreditos?: number; setEnvios?: number };
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
  const setEnvios =
    typeof body.setEnvios === "number" && Number.isFinite(body.setEnvios)
      ? Math.max(0, Math.floor(body.setEnvios))
      : undefined;

  if (!estadoIn && add <= 0 && setEnvios === undefined) {
    return NextResponse.json(
      { error: "Indicá estado, setEnvios o addCreditos" },
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

    const prev = snap.data() as Record<string, unknown>;
    const prevCreditos = normalizeEnviosDisponibles(prev.creditos);

    const updates: Record<string, unknown> = {};
    if (estadoIn) updates.estado = estadoIn;
    if (setEnvios !== undefined) {
      updates.creditos = setEnvios;
      const delta = setEnvios - prevCreditos;
      if (delta !== 0) {
        await db.collection("user_transactions").add({
          userId: uid,
          tipo: "ajuste",
          descripcion: `Ajuste admin de envíos: ${prevCreditos} → ${setEnvios}`,
          creditos: delta,
          monto: 0,
          fecha: FieldValue.serverTimestamp(),
        });
      }
    } else if (add > 0) {
      updates.creditos = FieldValue.increment(add);
      await db.collection("user_transactions").add({
        userId: uid,
        tipo: "regalo",
        descripcion: `Regalo admin (+${add} envíos)`,
        creditos: add,
        monto: 0,
        fecha: FieldValue.serverTimestamp(),
      });
    }

    await ref.update(updates);
    const nextCreditos = normalizeEnviosDisponibles(
      setEnvios !== undefined ? setEnvios : add > 0 ? prevCreditos + add : prevCreditos,
    );
    return NextResponse.json({ ok: true, enviosDisponibles: nextCreditos });
  } catch (e) {
    console.error("[admin/users PATCH]", e);
    return NextResponse.json({ error: "No se pudo actualizar el usuario" }, { status: 500 });
  }
}
