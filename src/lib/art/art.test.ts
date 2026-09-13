import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateEligibility, canAcceptAdhesion, statusAfterIdentity } from "./eligibility";
import { assertOtpPurposeForChannel, contactVerifiedByOtpChannel, verifyOtpAttempt } from "./otp-logic";
import { generateOtpCode, hashOtpCode, hashArtSecret, isExpired, newArtSecret } from "./tokens";
import { planContactChange } from "./contact-change";
import { parseCsvArtBulk, parseArtBulkRow } from "./bulk-parse";
import { hashTermsContent, canonicalConsentPayload, placeholderTermsContent } from "./terms";
import { blockchainStatusLabel, canonicalAuditPayload, hashAuditEvent, resolveBlockchainStatus, shouldAnchorOnChain } from "./audit-logic";
import { ManualOrPrevalidatedIdentityProvider } from "./identity/prevalidated";
import { getIdentityProvider } from "./identity/registry";
import { IdentityProviderNotConfiguredError } from "./identity/types";
import { DEFAULT_ART_CONFIG, type ArtRecipient } from "./types";
import { assertTenant } from "../public-api/tenant";
import { PublicApiError } from "../public-api/errors";
import { hasScope } from "../public-api/scopes";
import { WEBHOOK_EVENT_TYPES } from "../public-api/validation";
import { artModuleEnabled, artModuleUiHint } from "./enabled";
import { isExplicitNotificationType, parseNotificationType } from "./notification-type";
import { identityIsAuditable, parseIdentityAttestation } from "./identity-attestation";

function recipient(over: Partial<ArtRecipient> = {}): ArtRecipient {
  return {
    id: "art_rcp_1",
    orgId: "org_a",
    externalId: null,
    dni: "30111222",
    cuil: "20301112229",
    fullName: "Ana Perez",
    firstName: "Ana",
    lastName: "Perez",
    phone: "+5491112345678",
    email: "ana@test.com",
    status: "active",
    identityProvider: "ART_PREVALIDATED",
    identityVerificationId: "idp_1",
    identityVerificationStatus: "verified",
    identityVerificationAt: "2026-01-01T00:00:00.000Z",
    identityVerificationMetadata: { biometricStored: false },
    identityPrevalidatedByArt: true,
    identityVerificationMethod: "ART_INTERNAL_KYC",
    identityVerifiedAt: "2026-01-01T00:00:00.000Z",
    identitySource: "kyc_interno",
    identityExternalReference: "ref-1",
    identityVerifiedBy: "operador@art.test",
    identityAssuranceLevel: "ART_DECLARED",
    identityMetadata: {},
    phoneVerified: true,
    phoneVerifiedAt: "2026-01-01T00:00:00.000Z",
    emailVerified: true,
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    revalidationRequired: false,
    termsVersion: "draft-1",
    termsDocumentHash: "abc",
    termsAcceptedAt: "2026-01-01T00:00:00.000Z",
    consentIp: "1.1.1.1",
    consentUserAgent: "test",
    consentSessionId: "s1",
    adhesionId: "art_adh_1",
    activatedAt: "2026-01-01T00:00:00.000Z",
    revokedAt: null,
    revokeReason: null,
    lastEventHash: null,
    createdAt: null,
    updatedAt: null,
    ...over,
  };
}

test("adhesión válida habilita SRT_ART", () => {
  const r = evaluateEligibility({ moduleEnabled: true, recipient: recipient(), config: { ...DEFAULT_ART_CONFIG, orgId: "org_a" } });
  assert.equal(r.eligibleForElectronicNotification, true);
  assert.equal(r.conventionalChannelRequired, false);
  assert.equal(r.reason, "OK");
});

test("OTP incorrecto y máximo de intentos", () => {
  const challengeId = "ch_1";
  const codeHash = hashOtpCode(challengeId, "123456");
  const ch = { challengeId, codeHash, expiresAt: new Date(Date.now() + 60_000).toISOString(), attempts: 0, consumed: false, channel: "email" as const, purpose: "phone" as const };
  const bad = verifyOtpAttempt(ch, "000000");
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.reason, "invalid");
  const maxed = verifyOtpAttempt({ ...ch, attempts: 5 }, "123456");
  assert.equal(maxed.ok, false);
  if (!maxed.ok) assert.equal(maxed.reason, "max_attempts");
  const ok = verifyOtpAttempt(ch, "123456");
  assert.equal(ok.ok, true);
});

test("token vencido", () => {
  assert.equal(isExpired(new Date(Date.now() - 1000).toISOString()), true);
  assert.equal(isExpired(new Date(Date.now() + 60_000).toISOString()), false);
});

test("adhesión sin identidad cuando es obligatoria", () => {
  const gate = canAcceptAdhesion({
    status: "adhesion_pending",
    phoneVerified: true,
    emailVerified: true,
    identityVerified: false,
    config: { ...DEFAULT_ART_CONFIG, orgId: "org_a", requireIdentityVerification: true },
    termsAcceptedCheckbox: true,
    explicitAcceptAction: true,
  });
  assert.equal(gate.ok, false);
  if (!gate.ok) assert.equal(gate.reason, "identity_not_verified");
  const elig = evaluateEligibility({
    moduleEnabled: true,
    recipient: recipient({ identityVerificationStatus: "pending", identityPrevalidatedByArt: false, status: "adhesion_pending", adhesionId: null, termsAcceptedAt: null }),
    config: { ...DEFAULT_ART_CONFIG, orgId: "org_a" },
  });
  assert.equal(elig.reason, "NO_ADHESION");
});

test("adhesión prevalidada por ART exige attestation auditable", async () => {
  const p = new ManualOrPrevalidatedIdentityProvider();
  const verified = await p.startVerification({
    orgId: "org_a",
    recipientId: "r1",
    dni: "30111222",
    cuil: "20301112229",
    fullName: "Ana",
    attestation: {
      identityVerificationMethod: "ART_INTERNAL_KYC",
      identityVerifiedAt: "2026-01-01T00:00:00.000Z",
      identitySource: "kyc_interno",
      identityExternalReference: "exp-88",
      identityVerifiedBy: "operador@art.test",
      identityAssuranceLevel: "ART_DECLARED",
      identityMetadata: { desk: "alta" },
    },
  });
  assert.equal(verified.verified, true);
  assert.equal(verified.faceMatchVerified, false);
  assert.equal(verified.livenessVerified, false);
  const pending = await p.startVerification({
    orgId: "org_a",
    recipientId: "r1",
    dni: "30111222",
    cuil: "20301112229",
    fullName: "Ana",
    prevalidatedByArt: true,
  });
  assert.equal(pending.verified, false);
  assert.equal(statusAfterIdentity({ current: "pending", verified: true, requireIdentity: true }), "adhesion_pending");
});

test("revocación bloquea SRT_ART", () => {
  const r = evaluateEligibility({
    moduleEnabled: true,
    recipient: recipient({ status: "revoked" }),
    config: { ...DEFAULT_ART_CONFIG, orgId: "org_a" },
  });
  assert.equal(r.eligibleForElectronicNotification, false);
  assert.equal(r.reason, "REVOKED");
  assert.equal(r.conventionalChannelRequired, true);
});

test("cambio de celular y email exige revalidación", () => {
  const phone = planContactChange({
    recipient: recipient(),
    field: "phone",
    nextValue: "+5491199999999",
    revalidateOnPhoneChange: true,
    revalidateOnEmailChange: true,
  });
  assert.equal(phone.revalidationRequired, true);
  assert.equal(phone.change.previousValue, "+5491112345678");
  const email = planContactChange({
    recipient: recipient(),
    field: "email",
    nextValue: "nueva@test.com",
    revalidateOnPhoneChange: true,
    revalidateOnEmailChange: true,
  });
  assert.equal(email.revalidationRequired, true);
  assert.equal(email.nextStatus, "adhesion_pending");
});

test("usuario revocado no es elegible aunque tenga teléfono", () => {
  const r = evaluateEligibility({
    moduleEnabled: true,
    recipient: recipient({ status: "revoked", phoneVerified: true }),
    config: { ...DEFAULT_ART_CONFIG, orgId: "org_a" },
  });
  assert.equal(r.eligibleForElectronicNotification, false);
  assert.equal(r.reason, "REVOKED");
});

test("aislamiento entre empresas", () => {
  assert.throws(() => assertTenant("org_a", "org_b"), (e: unknown) => e instanceof PublicApiError && e.httpStatus === 404);
});

test("generación evidencia: hash de términos inmutable y payload canónico", () => {
  const a = hashTermsContent("texto v1");
  const b = hashTermsContent("texto v1");
  const c = hashTermsContent("texto v2");
  assert.equal(a, b);
  assert.notEqual(a, c);
  const payload = canonicalConsentPayload({
    adhesionId: "adh",
    orgId: "org",
    recipientId: "rcp",
    dni: "1",
    cuil: "2",
    phone: "+1",
    email: "a@b.c",
    termsVersion: "draft-1",
    termsDocumentHash: a,
    acceptedAt: "2026-01-01T00:00:00.000Z",
    ip: "1.1.1.1",
    userAgent: "ua",
    sessionId: "s",
    identityStatus: "verified",
    otpChallengeId: "otp1",
  });
  assert.match(payload, /art-adhesion-v1/);
  assert.match(placeholderTermsContent("Provincia ART"), /voluntaria/);
  assert.equal(placeholderTermsContent("X").includes("autorizada por la SRT"), false);
});

test("bulk import CSV", () => {
  const csv = "cuil,dni,nombre,apellido,telefono,email,externalId\n20301112229,30111222,Ana,Perez,+5491112345678,ana@test.com,ext-1\n20301112229,12,Bad,Row,123,x,e2\n";
  const parsed = parseCsvArtBulk(csv);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.errors.length, 1);
  assert.equal(parsed.rows[0].cuil, "20301112229");
  const bad = parseArtBulkRow({ cuil: "1", dni: "2", nombre: "A" }, 2);
  assert.equal(bad.ok, false);
});

test("webhooks ART están en el catálogo v1", () => {
  assert.ok(WEBHOOK_EVENT_TYPES.includes("art.adhesion.activated"));
  assert.ok(WEBHOOK_EVENT_TYPES.includes("art.adhesion.revoked"));
  assert.ok(WEBHOOK_EVENT_TYPES.includes("art.recipient.requires_conventional_channel"));
});

test("permisos API: art scopes y fallback notifications", () => {
  assert.equal(hasScope(["art:read"], "art:read"), true);
  assert.equal(hasScope(["notifications:write"], "art:write"), true);
  assert.equal(hasScope(["webhooks:read"], "art:write"), false);
});

test("cadena de auditoría", () => {
  const p1 = canonicalAuditPayload({
    eventId: "e1",
    timestamp: "t",
    orgId: "o",
    recipientId: "r",
    type: "ADHESION_ACCEPTED",
    actor: "worker",
    source: "art",
    previousHash: null,
    metadata: { a: 1 },
  });
  const h1 = hashAuditEvent(p1);
  const p2 = canonicalAuditPayload({
    eventId: "e2",
    timestamp: "t2",
    orgId: "o",
    recipientId: "r",
    type: "ADHESION_REVOKED",
    actor: "worker",
    source: "art",
    previousHash: h1,
    metadata: {},
  });
  assert.notEqual(hashAuditEvent(p1), hashAuditEvent(p2));
  assert.equal(shouldAnchorOnChain("ADHESION_ACCEPTED"), true);
  assert.equal(shouldAnchorOnChain("OTP_SENT"), false);
});

test("IdentityProvider no acopla RENAPER/Didit", async () => {
  const renaper = getIdentityProvider("RENAPER");
  await assert.rejects(() => renaper.startVerification({
    orgId: "o", recipientId: "r", dni: "1", cuil: "2", fullName: "x",
  }), (e: unknown) => e instanceof IdentityProviderNotConfiguredError);
  const secret = newArtSecret(32);
  assert.equal(secret.includes("/"), false);
  assert.notEqual(hashArtSecret(secret), secret);
  assert.equal(generateOtpCode(6).length, 6);
});

test("feature flag default off y SRT type parser", () => {
  assert.equal(artModuleEnabled(), false);
  assert.equal(parseNotificationType("SRT_ART"), "SRT_ART");
  assert.equal(parseNotificationType(undefined), "ORDINARY");
  assert.equal(isExplicitNotificationType(undefined), false);
  assert.equal(isExplicitNotificationType("ORDINARY"), true);
});

test("NEXT_PUBLIC no habilita autorización server-side", () => {
  const prevS = process.env.ART_MODULE_ENABLED;
  const prevP = process.env.NEXT_PUBLIC_ART_MODULE_ENABLED;
  try {
    process.env.ART_MODULE_ENABLED = "";
    process.env.NEXT_PUBLIC_ART_MODULE_ENABLED = "true";
    assert.equal(artModuleEnabled(), false);
    assert.equal(artModuleUiHint(), true);
    process.env.ART_MODULE_ENABLED = "true";
    process.env.NEXT_PUBLIC_ART_MODULE_ENABLED = "";
    assert.equal(artModuleEnabled(), true);
    assert.equal(artModuleUiHint(), false);
  } finally {
    if (prevS === undefined) delete process.env.ART_MODULE_ENABLED;
    else process.env.ART_MODULE_ENABLED = prevS;
    if (prevP === undefined) delete process.env.NEXT_PUBLIC_ART_MODULE_ENABLED;
    else process.env.NEXT_PUBLIC_ART_MODULE_ENABLED = prevP;
  }
});

test("identityVerified=true sin attestation no es auditable ni elegible", () => {
  const incomplete = recipient({
    identityPrevalidatedByArt: true,
    identityVerificationStatus: "verified",
    identityVerificationMethod: null,
    identityVerifiedAt: null,
    identitySource: null,
    identityVerifiedBy: null,
    identityAssuranceLevel: null,
  });
  assert.equal(identityIsAuditable(incomplete), false);
  const elig = evaluateEligibility({
    moduleEnabled: true,
    recipient: incomplete,
    config: { ...DEFAULT_ART_CONFIG, orgId: "org_a" },
  });
  assert.equal(elig.reason, "IDENTITY_NOT_VERIFIED");
  const parsed = parseIdentityAttestation({ identity_prevalidated: true });
  assert.equal(parsed.ok, false);
});

test("OTP email no marca teléfono; purpose phone no está disponible", () => {
  assert.equal(contactVerifiedByOtpChannel("email"), "email");
  assert.equal(contactVerifiedByOtpChannel("whatsapp"), "phone");
  const blocked = assertOtpPurposeForChannel("phone", "email");
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.reason, "phone_otp_unavailable");
  const ok = assertOtpPurposeForChannel("email", "email");
  assert.equal(ok.ok, true);
});

test("estados blockchain no afirman anclaje si no hay tx", () => {
  assert.equal(resolveBlockchainStatus({
    eventHash: "abc",
    polygonTxHash: null,
    chainConfigured: false,
    attempted: false,
    failed: false,
  }), "HASH_GENERATED");
  assert.equal(resolveBlockchainStatus({
    eventHash: "abc",
    polygonTxHash: "0x1",
    chainConfigured: true,
    attempted: true,
    failed: false,
  }), "BLOCKCHAIN_ANCHORED");
  assert.equal(resolveBlockchainStatus({
    eventHash: "abc",
    polygonTxHash: null,
    chainConfigured: true,
    attempted: true,
    failed: true,
  }), "BLOCKCHAIN_FAILED");
  const generated = blockchainStatusLabel("HASH_GENERATED", null);
  assert.match(generated, /No registrado en blockchain/i);
  assert.equal(generated.toLowerCase().includes("registrado en blockchain") && generated.startsWith("Anclado"), false);
});

test("sin adhesión no hay envío electrónico SRT", () => {
  const r = evaluateEligibility({
    moduleEnabled: true,
    recipient: null,
    config: { ...DEFAULT_ART_CONFIG, orgId: "org_a" },
  });
  assert.equal(r.reason, "NO_ADHESION");
  assert.equal(r.eligibleForElectronicNotification, false);
});

test("aceptación requiere acción positiva", () => {
  const gate = canAcceptAdhesion({
    status: "adhesion_pending",
    phoneVerified: true,
    emailVerified: true,
    identityVerified: true,
    config: { ...DEFAULT_ART_CONFIG, orgId: "o" },
    termsAcceptedCheckbox: false,
    explicitAcceptAction: true,
  });
  assert.equal(gate.ok, false);
});
