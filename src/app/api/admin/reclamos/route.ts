import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { RECLAMO_ESTADOS, type ReclamoEstado } from "@/lib/reclamos";

function serializeFirestoreValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (
    typeof v === "object" &&
    v !== null &&
    "toDate" in v &&
    typeof (v as { toDate: unknown }).toDate === "function"
  ) {
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
  const denied = assertAdminSession(request);
  if (denied) return denied;

  const estadoParam = request.nextUrl.searchParams.get("estado");
  const estado =
    estadoParam && RECLAMO_ESTADOS.includes(estadoParam as ReclamoEstado)
      ? (estadoParam as ReclamoEstado)
      : null;

  try {
    const db = getAdminDb();
    let query = db.collection("reclamos").orderBy("createdAt", "desc").limit(100);

    if (estado) {
      query = db
        .collection("reclamos")
        .where("estado", "==", estado)
        .orderBy("createdAt", "desc")
        .limit(100);
    }

    const snap = await query.get();
    const reclamos = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(serializeFirestoreValue(docSnap.data()) as Record<string, unknown>),
    }));

    return NextResponse.json({ reclamos });
  } catch (e) {
    console.error("[admin/reclamos GET]", e);
    return NextResponse.json(
      { error: "No se pudieron leer los reclamos" },
      { status: 500 },
    );
  }
}

const patchSchema = z.object({
  id: z.string().trim().min(1),
  estado: z.enum(RECLAMO_ESTADOS).optional(),
  adminNotas: z.string().trim().max(8000).optional(),
});

export async function PATCH(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id, estado, adminNotas } = parsed.data;
  if (!estado && adminNotas === undefined) {
    return NextResponse.json(
      { error: "Indicá estado o notas para actualizar" },
      { status: 400 },
    );
  }

  try {
    const db = getAdminDb();
    const ref = db.collection("reclamos").doc(id);
    const existing = await ref.get();
    if (!existing.exists) {
      return NextResponse.json({ error: "Reclamo no encontrado" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (estado) updates.estado = estado;
    if (adminNotas !== undefined) updates.adminNotas = adminNotas;

    await ref.update(updates);

    const updated = await ref.get();
    return NextResponse.json({
      reclamo: {
        id: updated.id,
        ...(serializeFirestoreValue(updated.data()) as Record<string, unknown>),
      },
    });
  } catch (e) {
    console.error("[admin/reclamos PATCH]", e);
    return NextResponse.json(
      { error: "No se pudo actualizar el reclamo" },
      { status: 500 },
    );
  }
}
