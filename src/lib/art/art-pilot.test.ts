import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateEligibility } from "./eligibility";
import { DEFAULT_ART_CONFIG, type ArtRecipient } from "./types";
import { artModuleEnabled, artModuleUiHint } from "./enabled";
import { parseNotificationType } from "./notification-type";
import {
  ART_MODULE_NOT_AVAILABLE,
  NOTIFICATION_TYPE_REQUIRED,
  PILOT_BULK_LIMIT,
  PILOT_CAMPAIGN_LIMIT,
  PILOT_RECIPIENT_NOT_ALLOWED,
  artGeneralReleaseEnabled,
  artModuleAvailableForOrg,
  artModuleReleased,
  artPilotControlsApply,
  artPilotEvidenceMarks,
  assertArtOrgAccess,
  assertExplicitNotificationType,
  assertPilotBulkLimit,
  assertPilotCampaignLimit,
  assertPilotRecipientAllowed,
  evidenceRetentionUiCopy,
  evidenceRetentionYears,
} from "./pilot";
import { assertArtOutboundClassification } from "./outbound-guards";
import { placeholderTermsContent, PLACEHOLDER_TERMS_TITLE } from "./terms";

function recipient(over: Partial<ArtRecipient> = {}): ArtRecipient {
  return {
    id: "art_rcp_1",
    orgId: "org_pilot",
    externalId: null,
    dni: "99900001",
    cuil: "20999000013",
    fullName: "TEST TRABAJADOR 01",
    firstName: "TEST",
    lastName: "TRABAJADOR",
    phone: "+5491111111111",
    email: "pilot@notificas.test",
    status: "active",
    identityProvider: "ART_PREVALIDATED",
    identityVerificationId: "idp_1",
    identityVerificationStatus: "verified",
    identityVerificationAt: "2026-01-01T00:00:00.000Z",
    identityVerificationMetadata: { biometricStored: false },
    identityPrevalidatedByArt: true,
    identityVerificationMethod: "ART_INTERNAL_KYC",
    identityVerifiedAt: "2026-01-01T00:00:00.000Z",
    identitySource: "NOTIFICAS_INTERNAL_PILOT",
    identityExternalReference: "TEST-REF",
    identityVerifiedBy: "operador-piloto",
    identityAssuranceLevel: "TEST_DECLARED",
    identityMetadata: { environment: "production_pilot" },
    phoneVerified: false,
    phoneVerifiedAt: null,
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

const KEYS = [
  "ART_MODULE_ENABLED",
  "NEXT_PUBLIC_ART_MODULE_ENABLED",
  "ART_PILOT_MODE",
  "ART_GENERAL_RELEASE_ENABLED",
  "ART_ALLOWED_ORGS",
  "ART_PILOT_EMAIL_ALLOWLIST",
  "ART_PILOT_PHONE_ALLOWLIST",
  "ART_PILOT_MAX_RECIPIENTS",
  "ART_PILOT_MAX_CAMPAIGN_RECIPIENTS",
  "EVIDENCE_RETENTION_YEARS",
] as const;

function withEnv(patch: Record<string, string | undefined>, fn: () => void) {
  const prev: Record<string, string | undefined> = {};
  for (const k of KEYS) prev[k] = process.env[k];
  try {
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fn();
  } finally {
    for (const k of KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

test("fail-closed 1. MODULE=false → ART cerrado (404 lógico)", () => {
  withEnv(
    {
      ART_MODULE_ENABLED: "",
      ART_PILOT_MODE: "true",
      ART_GENERAL_RELEASE_ENABLED: "true",
      ART_ALLOWED_ORGS: "org_pilot",
    },
    () => {
      assert.equal(artModuleEnabled(), false);
      assert.equal(artModuleReleased(), false);
      assert.equal(artModuleAvailableForOrg("org_pilot"), false);
      assert.equal(assertArtOrgAccess("org_pilot").ok, false);
    }
  );
});

test("fail-closed 2. MODULE=true + PILOT=true → solo allowlist", () => {
  withEnv(
    {
      ART_MODULE_ENABLED: "true",
      ART_PILOT_MODE: "true",
      ART_GENERAL_RELEASE_ENABLED: "true",
      ART_ALLOWED_ORGS: "org_pilot",
    },
    () => {
      assert.equal(artModuleReleased(), true);
      assert.equal(artModuleAvailableForOrg("org_pilot"), true);
      assert.equal(artModuleAvailableForOrg("org_cliente"), false);
      const denied = assertArtOrgAccess("org_cliente");
      assert.equal(denied.ok, false);
      if (!denied.ok) {
        assert.equal(denied.code, ART_MODULE_NOT_AVAILABLE);
        assert.equal(denied.httpStatus, 403);
      }
    }
  );
});

test("fail-closed 3. MODULE=true + PILOT=false + GENERAL_RELEASE=false → cerrado para todos", () => {
  withEnv(
    {
      ART_MODULE_ENABLED: "true",
      ART_PILOT_MODE: "",
      ART_GENERAL_RELEASE_ENABLED: "",
      NEXT_PUBLIC_ART_MODULE_ENABLED: "true",
      ART_ALLOWED_ORGS: "org_pilot",
    },
    () => {
      assert.equal(artModuleEnabled(), true);
      assert.equal(artModuleUiHint(), true);
      assert.equal(artGeneralReleaseEnabled(), false);
      assert.equal(artModuleReleased(), false);
      assert.equal(artModuleAvailableForOrg("org_pilot"), false);
      assert.equal(artModuleAvailableForOrg("org_cliente"), false);
      const denied = assertArtOrgAccess("org_pilot");
      assert.equal(denied.ok, false);
      if (!denied.ok) {
        assert.equal(denied.code, ART_MODULE_NOT_AVAILABLE);
        assert.equal(denied.httpStatus, 403);
      }
    }
  );
});

test("fail-closed 4. MODULE=true + PILOT=false + GENERAL_RELEASE=true → funcionamiento general", () => {
  withEnv(
    {
      ART_MODULE_ENABLED: "true",
      ART_PILOT_MODE: "",
      ART_GENERAL_RELEASE_ENABLED: "true",
    },
    () => {
      assert.equal(artModuleReleased(), true);
      assert.equal(artModuleAvailableForOrg("org_cliente"), true);
      assert.equal(assertArtOrgAccess("org_cualquiera").ok, true);
    }
  );
});

test("A. org permitida puede acceder ART", () => {
  withEnv(
    {
      ART_MODULE_ENABLED: "true",
      ART_PILOT_MODE: "true",
      ART_ALLOWED_ORGS: "org_pilot",
    },
    () => {
      assert.equal(artModuleAvailableForOrg("org_pilot"), true);
      assert.equal(assertArtOrgAccess("org_pilot").ok, true);
    }
  );
});

test("B. org no incluida recibe 403 ART_MODULE_NOT_AVAILABLE", () => {
  withEnv(
    {
      ART_MODULE_ENABLED: "true",
      ART_PILOT_MODE: "true",
      ART_ALLOWED_ORGS: "org_pilot",
    },
    () => {
      const denied = assertArtOrgAccess("org_cliente");
      assert.equal(denied.ok, false);
      if (!denied.ok) {
        assert.equal(denied.code, ART_MODULE_NOT_AVAILABLE);
        assert.equal(denied.httpStatus, 403);
      }
      assert.equal(artModuleAvailableForOrg("org_cliente"), false);
    }
  );
});

test("C. manipular NEXT_PUBLIC no habilita ART", () => {
  withEnv(
    {
      ART_MODULE_ENABLED: "",
      NEXT_PUBLIC_ART_MODULE_ENABLED: "true",
      ART_PILOT_MODE: "true",
      ART_ALLOWED_ORGS: "org_pilot",
    },
    () => {
      assert.equal(artModuleEnabled(), false);
      assert.equal(artModuleUiHint(), true);
      assert.equal(artModuleAvailableForOrg("org_pilot"), false);
      const denied = assertArtOrgAccess("org_pilot");
      assert.equal(denied.ok, false);
    }
  );
});

test("D. email fuera de allowlist no envía", () => {
  withEnv(
    {
      ART_MODULE_ENABLED: "true",
      ART_PILOT_MODE: "true",
      ART_ALLOWED_ORGS: "org_pilot",
      ART_PILOT_EMAIL_ALLOWLIST: "ok@notificas.test",
      ART_PILOT_PHONE_ALLOWLIST: "+5491111111111",
    },
    () => {
      const r = assertPilotRecipientAllowed({
        orgId: "org_pilot",
        email: "otro@cliente.com",
        phone: "+5491111111111",
      });
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.code, PILOT_RECIPIENT_NOT_ALLOWED);
    }
  );
});

test("E. teléfono fuera de allowlist no envía", () => {
  withEnv(
    {
      ART_MODULE_ENABLED: "true",
      ART_PILOT_MODE: "true",
      ART_ALLOWED_ORGS: "org_pilot",
      ART_PILOT_EMAIL_ALLOWLIST: "ok@notificas.test",
      ART_PILOT_PHONE_ALLOWLIST: "+5491111111111",
    },
    () => {
      const r = assertPilotRecipientAllowed({
        orgId: "org_pilot",
        email: "ok@notificas.test",
        phone: "+5491100000000",
      });
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.code, PILOT_RECIPIENT_NOT_ALLOWED);
    }
  );
});

test("F. campaña >10 destinatarios rechazada", () => {
  withEnv(
    {
      ART_MODULE_ENABLED: "true",
      ART_PILOT_MODE: "true",
      ART_ALLOWED_ORGS: "org_pilot",
    },
    () => {
      const r = assertPilotCampaignLimit(11, "org_pilot");
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.code, PILOT_CAMPAIGN_LIMIT);
      assert.equal(assertPilotCampaignLimit(10, "org_pilot").ok, true);
      assert.equal(assertPilotCampaignLimit(50, "org_cliente").ok, true);
    }
  );
});

test("G. bulk >10 rechazado", () => {
  withEnv(
    {
      ART_MODULE_ENABLED: "true",
      ART_PILOT_MODE: "true",
      ART_ALLOWED_ORGS: "org_pilot",
    },
    () => {
      const r = assertPilotBulkLimit(11, "org_pilot");
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.code, PILOT_BULK_LIMIT);
    }
  );
});

test("H. SRT_ART + ACTIVE permitido", () => {
  const r = evaluateEligibility({
    moduleEnabled: true,
    recipient: recipient({ status: "active", emailVerified: true, phoneVerified: false }),
    config: { ...DEFAULT_ART_CONFIG, orgId: "org_pilot" },
  });
  assert.equal(r.eligibleForElectronicNotification, true);
  assert.equal(r.reason, "OK");
});

test("I. SRT_ART + REVOKED bloqueado", () => {
  const r = evaluateEligibility({
    moduleEnabled: true,
    recipient: recipient({ status: "revoked", revokedAt: "2026-02-01T00:00:00.000Z" }),
    config: { ...DEFAULT_ART_CONFIG, orgId: "org_pilot" },
  });
  assert.equal(r.eligibleForElectronicNotification, false);
  assert.equal(r.reason, "REVOKED");
});

test("J. ORDINARY + REVOKED no corre eligibility SRT y allowlist sí aplica", () => {
  assert.equal(parseNotificationType("ORDINARY"), "ORDINARY");
  assert.notEqual(parseNotificationType("ORDINARY"), "SRT_ART");
  withEnv(
    {
      ART_MODULE_ENABLED: "true",
      ART_PILOT_MODE: "true",
      ART_ALLOWED_ORGS: "org_pilot",
      ART_PILOT_EMAIL_ALLOWLIST: "pilot@notificas.test",
      ART_PILOT_PHONE_ALLOWLIST: "+5491111111111",
    },
    () => {
      assert.equal(
        assertPilotRecipientAllowed({
          orgId: "org_pilot",
          email: "pilot@notificas.test",
          phone: "+5491111111111",
        }).ok,
        true
      );
    }
  );
});

test("K. SRT individual sin clasificación explícita exige selección", () => {
  withEnv(
    {
      ART_MODULE_ENABLED: "true",
      ART_PILOT_MODE: "true",
      ART_ALLOWED_ORGS: "org_pilot",
    },
    () => {
      const missing = assertArtOutboundClassification("org_pilot", undefined);
      assert.equal(missing.ok, false);
      if (!missing.ok) assert.equal(missing.code, NOTIFICATION_TYPE_REQUIRED);
      const otherOrg = assertArtOutboundClassification("org_cliente", undefined);
      assert.equal(otherOrg.ok, true);
      assert.equal(assertExplicitNotificationType("SRT_ART", { required: true }).ok, true);
    }
  );
});

test("L. evidencia piloto identificada como TEST", () => {
  withEnv({ ART_PILOT_MODE: "true" }, () => {
    const marks = artPilotEvidenceMarks();
    assert.equal(marks.testMode, "PRODUCTION_PILOT");
    assert.equal(marks.banner, "PRUEBA INTERNA NOTIFICAS");
    assert.equal(marks.subtitle, "TEST MODE: PRODUCTION PILOT");
    assert.equal(marks.isTestEvidence, true);
    assert.match(placeholderTermsContent("ART DEMO"), /PRUEBA INTERNA - SIN EFECTOS FRENTE A TERCEROS/);
    assert.match(PLACEHOLDER_TERMS_TITLE, /PRUEBA INTERNA/);
    assert.equal(placeholderTermsContent("ART DEMO").includes("autorizado por SRT"), false);
    assert.equal(placeholderTermsContent("ART DEMO").includes("aprobado por SRT"), false);
    assert.equal(placeholderTermsContent("ART DEMO").includes("cumple SRT"), false);
    assert.equal(placeholderTermsContent("ART DEMO").includes("notificación legal válida"), false);
  });
});

test("M. retención mostrada = 5 años", () => {
  withEnv({ EVIDENCE_RETENTION_YEARS: undefined }, () => {
    assert.equal(evidenceRetentionYears(), 5);
    assert.equal(evidenceRetentionUiCopy(), "Conservación configurada actualmente: 5 años.");
    assert.equal(DEFAULT_ART_CONFIG.evidenceRetentionYears, 5);
  });
});

test("piloto vacío fail-closed y otras orgs no reciben allowlist", () => {
  withEnv(
    {
      ART_MODULE_ENABLED: "true",
      ART_PILOT_MODE: "true",
      ART_ALLOWED_ORGS: "",
    },
    () => {
      assert.equal(artModuleAvailableForOrg("org_pilot"), false);
      assert.equal(artPilotControlsApply("org_real"), false);
    }
  );
});
