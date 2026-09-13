import { createHash } from "crypto";
import { artPilotMode } from "@/lib/art/pilot";

export function hashTermsContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export const PLACEHOLDER_TERMS_TITLE = "TERMINOS DE ADHESIÓN - PRUEBA INTERNA NOTIFICAS";

export function placeholderTermsContent(artName: string): string {
  const name = artName.trim() || "la organización";
  if (artPilotMode()) {
    return [
      "PRUEBA INTERNA - SIN EFECTOS FRENTE A TERCEROS",
      "",
      "TERMINOS DE ADHESIÓN - PRUEBA INTERNA NOTIFICAS",
      "",
      `Estos términos se usan únicamente para probar el funcionamiento técnico del módulo de adhesión de ${name} en un entorno de producción controlado.`,
      "No generan efectos frente a terceros. No constituyen notificación jurídica ni habilitación operativa hacia trabajadores reales.",
      "",
      "La adhesión de prueba es voluntaria y se puede revocar. El objetivo es validar invitaciones, OTP por email, evidencia, hash y anclaje técnico.",
    ].join("\n");
  }
  return [
    "BORRADOR — texto administrable. No constituye términos definitivos.",
    "",
    `La adhesión es voluntaria. Podrás revocarla posteriormente. La aceptación habilita a ${name} a utilizar los canales electrónicos informados para las comunicaciones comprendidas en el sistema implementado.`,
    "",
    "Este documento es un placeholder técnico. Los términos legales definitivos serán cargados posteriormente.",
  ].join("\n");
}

export function canonicalConsentPayload(input: {
  adhesionId: string;
  orgId: string;
  recipientId: string;
  dni: string;
  cuil: string;
  phone: string;
  email: string;
  termsVersion: string;
  termsDocumentHash: string;
  acceptedAt: string;
  ip: string;
  userAgent: string;
  sessionId: string;
  identityStatus: string;
  otpChallengeId: string | null;
}): string {
  return [
    "art-adhesion-v1",
    input.adhesionId,
    input.orgId,
    input.recipientId,
    input.dni,
    input.cuil,
    input.phone,
    input.email,
    input.termsVersion,
    input.termsDocumentHash,
    input.acceptedAt,
    input.ip,
    input.userAgent,
    input.sessionId,
    input.identityStatus,
    input.otpChallengeId || "",
  ].join("|");
}
