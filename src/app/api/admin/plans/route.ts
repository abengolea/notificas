import { NextRequest, NextResponse } from "next/server";
import {
  FieldValue,
  Timestamp,
  type DocumentData,
} from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPanelConfig,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

type PlanPayload = {
  id?: string;
  nombre?: string;
  descripcion?: string;
  precio?: number;
  creditos?: number;
  type?: "unitario" | "pack" | "suscripcion";
  activo?: boolean;
  orden?: number;
};

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

function serializeDoc(id: string, data: DocumentData) {
  const { createdAt, updatedAt, ...rest } = data;
  const out: Record<string, unknown> = { id, ...rest };
  if (createdAt instanceof Timestamp) out.createdAt = createdAt.toDate().toISOString();
  if (updatedAt instanceof Timestamp) out.updatedAt = updatedAt.toDate().toISOString();
  return out;
}

/** Lista todos los documentos `plans/{id}` (incluye inactivos) para gestión admin. */
export async function GET(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  try {
    const db = getAdminDb();
    const snap = await db.collection("plans").get();
    const plans = snap.docs
      .map((d) => serializeDoc(d.id, d.data()))
      .sort((a, b) => ((a.orden as number) ?? 0) - ((b.orden as number) ?? 0));
    return NextResponse.json({ plans });
  } catch (e) {
    console.error("admin/plans GET", e);
    return NextResponse.json({ error: "Error leyendo planes" }, { status: 500 });
  }
}

function validatePayload(body: PlanPayload, requireAll: boolean): string | null {
  if (!requireAll && body.id && typeof body.id !== "string") return "id inválido";

  const need = ["nombre", "descripcion", "precio", "creditos", "type"] as const;
  if (requireAll) {
    for (const k of need) {
      if (body[k] === undefined || body[k] === null) return `Falta ${k}`;
    }
  }
  if (body.precio != null && (typeof body.precio !== "number" || body.precio < 0))
    return "precio inválido";
  if (body.creditos != null && (!Number.isInteger(body.creditos) || body.creditos < 0))
    return "creditos inválido";
  if (body.type != null && !["unitario", "pack", "suscripcion"].includes(body.type))
    return "type inválido";
  return null;
}

export async function POST(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  let body: PlanPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const err = validatePayload(body, true);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const id =
    typeof body.id === "string" && body.id.trim()
      ? body.id.trim()
      : `plan_${Date.now()}`;

  const db = getAdminDb();
  const ref = db.collection("plans").doc(id);
  const existing = await ref.get();
  if (existing.exists) {
    return NextResponse.json({ error: "Ya existe un plan con ese id" }, { status: 409 });
  }

  const orden =
    typeof body.orden === "number" && Number.isFinite(body.orden)
      ? body.orden
      : Math.floor(Date.now() / 1000);

  await ref.set({
    nombre: body.nombre!.trim(),
    descripcion: body.descripcion!.trim(),
    precio: body.precio,
    creditos: body.creditos,
    type: body.type,
    activo: body.activo !== false,
    orden,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const snap = await ref.get();
  return NextResponse.json({ plan: serializeDoc(snap.id, snap.data()!) });
}

export async function PATCH(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  let body: PlanPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  const err = validatePayload(body, false);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const db = getAdminDb();
  const ref = db.collection("plans").doc(body.id);
  const existing = await ref.get();
  if (!existing.exists) {
    return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });
  }

  const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (body.nombre !== undefined) patch.nombre = String(body.nombre).trim();
  if (body.descripcion !== undefined) patch.descripcion = String(body.descripcion).trim();
  if (body.precio !== undefined) patch.precio = body.precio;
  if (body.creditos !== undefined) patch.creditos = body.creditos;
  if (body.type !== undefined) patch.type = body.type;
  if (body.activo !== undefined) patch.activo = body.activo;
  if (body.orden !== undefined) patch.orden = body.orden;

  await ref.update(patch);
  const snap = await ref.get();
  return NextResponse.json({ plan: serializeDoc(snap.id, snap.data()!) });
}

/** Baja lógica: marca `activo: false` (Mercado Pago y transacciones pueden referenciar el doc). */
export async function DELETE(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const db = getAdminDb();
  const ref = db.collection("plans").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });

  await ref.update({
    activo: false,
    updatedAt: FieldValue.serverTimestamp(),
  });
  const updated = await ref.get();
  return NextResponse.json({ plan: serializeDoc(updated.id, updated.data()!) });
}
