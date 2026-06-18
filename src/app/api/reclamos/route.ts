import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  sendReclamoAckToCustomer,
  sendReclamoNotifyAdmin,
} from "@/lib/reclamos-email";
import { formatTicketNumber } from "@/lib/reclamos";

const bodySchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  telefono: z.string().trim().max(40).optional().default(""),
  mensaje: z.string().trim().min(10).max(8000),
});

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisá nombre, email y mensaje (mínimo 10 caracteres)." },
      { status: 400 },
    );
  }

  const { nombre, email, telefono, mensaje } = parsed.data;

  try {
    const db = getAdminDb();
    const ref = db.collection("reclamos").doc();
    const ticketNumber = formatTicketNumber(ref.id);

    await ref.set({
      ticketNumber,
      nombre,
      email: email.toLowerCase(),
      telefono: telefono || null,
      mensaje,
      estado: "nuevo",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const emailData = {
      ticketNumber,
      nombre,
      email,
      telefono: telefono || undefined,
      mensaje,
    };

    const [notifyResult, ackResult] = await Promise.all([
      sendReclamoNotifyAdmin(emailData),
      sendReclamoAckToCustomer(emailData),
    ]);

    const updates: Record<string, unknown> = {};
    if (notifyResult.docId) updates.notifyMailDocId = notifyResult.docId;
    if (ackResult.docId) updates.ackMailDocId = ackResult.docId;
    if (Object.keys(updates).length > 0) {
      await ref.update(updates);
    }

    if (!notifyResult.ok || !ackResult.ok) {
      console.error("POST /api/reclamos emails:", { notifyResult, ackResult });
      return NextResponse.json(
        {
          ok: true as const,
          ticketNumber,
          id: ref.id,
          warning:
            "Reclamo registrado. Hubo un problema al enviar uno de los correos; el equipo fue notificado internamente.",
        },
        { status: 201 },
      );
    }

    return NextResponse.json(
      { ok: true as const, ticketNumber, id: ref.id },
      { status: 201 },
    );
  } catch (e) {
    console.error("POST /api/reclamos:", e);
    return NextResponse.json(
      { error: "Error al registrar el reclamo. Intentá más tarde." },
      { status: 500 },
    );
  }
}
