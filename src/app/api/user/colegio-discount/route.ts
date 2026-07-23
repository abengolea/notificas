import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth-helper";
import { resolveColegioDiscountForEmail, getColegioFallbackBannerNombre } from "@/lib/colegio-discount-server";

/**
 * Indica si la cuenta autenticada (email del JWT) tiene descuento:
 * - colegio (convenio) o
 * - usuario registrado en LegalMev (20%, sin envíos gratis).
 * No expone la lista de matriculados.
 */
export async function GET(request: NextRequest) {
  const { decoded, errorResponse } = await verifyAuthToken(request);
  if (errorResponse) return errorResponse;

  const email =
    typeof decoded.email === "string" && decoded.email.trim()
      ? decoded.email
      : "";
  if (!email) {
    const nombreColegio = await getColegioFallbackBannerNombre();
    return NextResponse.json(
      { eligible: false, discountPercent: 0, nombreColegio, source: null },
      { status: 200 },
    );
  }

  const resolved = await resolveColegioDiscountForEmail(email);
  return NextResponse.json({
    eligible: resolved.eligible,
    discountPercent: resolved.discountPercent,
    nombreColegio: resolved.nombreColegio,
    source: resolved.source,
  });
}
