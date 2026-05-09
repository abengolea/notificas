import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

/**
 * Permite al lector público cargar un mensaje sin Firebase Auth en el cliente.
 * Las reglas de Firestore exigen sesión; el destinatario autentica con `k` (tracking.token).
 */
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    const k = request.nextUrl.searchParams.get("k");

    if (!id || !k) {
      return NextResponse.json(
        { error: "Faltan parámetros id o k" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const snap = await db.collection("mail").doc(id).get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Mensaje no encontrado" }, { status: 404 });
    }

    const data = snap.data()!;
    const storedToken =
      (data.tracking && typeof data.tracking.token === "string"
        ? data.tracking.token
        : null) ??
      (typeof data.trackingToken === "string" ? data.trackingToken : null);

    if (!storedToken || storedToken !== k) {
      return NextResponse.json({ error: "Enlace inválido o caducado" }, { status: 401 });
    }

    return NextResponse.json({ mail: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String((e as { code?: unknown }).code ?? "")
        : "";
    console.error("for-reader GET error:", msg, "| code:", code);
    if (
      msg.includes("credential") ||
      msg.includes("UNAUTHENTICATED") ||
      code === "16"
    ) {
      console.error(
        "for-reader: posible problema de credenciales Admin SDK — verificar FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en Secret Manager"
      );
    }
    if (msg.includes("DEADLINE_EXCEEDED") || msg.includes("timeout")) {
      console.error(
        "for-reader: timeout de conexión a Firestore — posible problema de red o permisos IAM"
      );
    }
    return NextResponse.json(
      { error: "Error al cargar el mensaje" },
      { status: 500 }
    );
  }
}
