import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/auth-helper";
import { getAdminDb } from "@/lib/firebase-admin";
import { hasPendingPasswordOnboarding } from "@/lib/legacy-migration";

/**
 * Tras un login exitoso, marca que el usuario migrado ya definió contraseña usable
 * (p. ej. vía enlace de recuperación). Idempotente.
 */
export async function POST(request: NextRequest) {
  const { decoded, errorResponse } = await verifyAuthToken(request);
  if (errorResponse) return errorResponse;
  const uid = decoded!.uid;

  try {
    const db = getAdminDb();
    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ updated: false, reason: "no_profile" });
    }
    const d = snap.data() as Record<string, unknown>;
    if (!hasPendingPasswordOnboarding(d)) {
      return NextResponse.json({ updated: false, reason: "not_applicable" });
    }

    await ref.update({
      mustSetPassword: false,
      passwordSetAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ updated: true });
  } catch (e) {
    console.error("[migration-password-complete]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
