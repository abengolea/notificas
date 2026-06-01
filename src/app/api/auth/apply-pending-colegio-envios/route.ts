import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth-helper";
import { applyPendingColegioEnvios } from "@/lib/colegio-pending-envios-server";

/** Acredita envíos reservados para matriculados al registrarse o iniciar sesión. */
export async function POST(request: NextRequest) {
  const { decoded, errorResponse } = await verifyAuthToken(request);
  if (errorResponse) return errorResponse;

  const uid = decoded!.uid;
  const email = decoded!.email ?? "";

  try {
    const result = await applyPendingColegioEnvios(uid, email);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[apply-pending-colegio-envios]", e);
    return NextResponse.json({ error: "No se pudo aplicar el bono" }, { status: 500 });
  }
}
