import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handlePublicApi, publicApiOptionsResponse, readJsonLimited } from "@/lib/public-api/handler";
import { PublicApiError } from "@/lib/public-api/errors";
import { assertPublicArtOrg, rethrowArtAsPublic } from "@/lib/art/public-gate";
import { upsertRecipient, listRecipients } from "@/lib/art/store";
import { publicApiRecipientView } from "@/lib/art/views";
import { createInvitation } from "@/lib/art/invite";
import { startOrApplyIdentity } from "@/lib/art/identity-flow";
import { parseIdentityAttestation } from "@/lib/art/identity-attestation";

const createSchema = z.object({
  cuil: z.string().min(8),
  dni: z.string().min(6),
  full_name: z.string().min(2).optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  external_id: z.string().optional(),
  identity_prevalidated: z.boolean().optional(),
  identity_attestation: z.record(z.string(), z.unknown()).optional(),
  send_invite: z.boolean().optional(),
});

export function OPTIONS() {
  return publicApiOptionsResponse();
}

export async function GET(request: NextRequest) {
  return handlePublicApi(request, { scope: "art:read", rateBucket: "general" }, async (ctx) => {
    assertPublicArtOrg(ctx.orgId);
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const result = await listRecipients(ctx.orgId, { status, limit: 50 });
    return NextResponse.json({ data: result.recipients.map(publicApiRecipientView) });
  });
}

export async function POST(request: NextRequest) {
  return handlePublicApi(
    request,
    { scope: "art:write", rateBucket: "general", extraRateBucket: "notifications" },
    async (ctx) => {
      assertPublicArtOrg(ctx.orgId);
      const body = await readJsonLimited(request, 32 * 1024);
      const parsed = createSchema.safeParse(body);
      if (!parsed.success) {
        throw new PublicApiError({
          httpStatus: 400,
          type: "validation_error",
          code: "invalid_request",
          message: parsed.error.issues[0]?.message || "Invalid request.",
        });
      }
      const fullName =
        parsed.data.full_name ||
        `${parsed.data.first_name || ""} ${parsed.data.last_name || ""}`.trim();
      let attestation = null;
      if (parsed.data.identity_prevalidated) {
        const att = parseIdentityAttestation(parsed.data.identity_attestation, {
          verifiedBy: ctx.apiKeyPrefix,
          source: "public_api",
        });
        if (!att.ok) {
          throw new PublicApiError({
            httpStatus: 400,
            type: "validation_error",
            code: att.reason,
            message: "identity_attestation is required when identity_prevalidated is true.",
          });
        }
        attestation = att.value;
      }
      try {
      const { recipient, created } = await upsertRecipient({
        orgId: ctx.orgId,
        cuil: parsed.data.cuil,
        dni: parsed.data.dni,
        fullName,
        firstName: parsed.data.first_name,
        lastName: parsed.data.last_name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        externalId: parsed.data.external_id,
        identityPrevalidatedByArt: parsed.data.identity_prevalidated === true,
        identityAttestation: attestation,
      });
      if (attestation) {
        await startOrApplyIdentity({
          orgId: ctx.orgId,
          recipient,
          attestation,
          actor: ctx.apiKeyPrefix,
        });
      }
      let invite = null;
      if (parsed.data.send_invite !== false) {
        const inv = await createInvitation({
          orgId: ctx.orgId,
          orgName: ctx.orgName,
          recipient,
          actor: ctx.apiKeyPrefix,
          send: true,
        });
        invite = { url: inv.url, expires_at: inv.expiresAt };
      }
      return NextResponse.json(
        { data: publicApiRecipientView(recipient), invite },
        { status: created ? 201 : 200 }
      );
      } catch (e) {
        rethrowArtAsPublic(e);
      }
    }
  );
}
