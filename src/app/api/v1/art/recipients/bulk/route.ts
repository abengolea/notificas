import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handlePublicApi, publicApiOptionsResponse, readJsonLimited } from "@/lib/public-api/handler";
import { PublicApiError } from "@/lib/public-api/errors";
import { createBulkJob } from "@/lib/art/bulk";
import { parseIdentityAttestation } from "@/lib/art/identity-attestation";
import { assertPublicArtOrg, rethrowArtAsPublic } from "@/lib/art/public-gate";

const bulkSchema = z.object({
  send_invites: z.boolean().optional(),
  identity_prevalidated: z.boolean().optional(),
  identity_attestation: z.record(z.string(), z.unknown()).optional(),
  csv: z.string().min(10).max(2_000_000),
});

export function OPTIONS() {
  return publicApiOptionsResponse();
}

export async function POST(request: NextRequest) {
  return handlePublicApi(request, { scope: "art:write", rateBucket: "batches" }, async (ctx) => {
    assertPublicArtOrg(ctx.orgId);
    const body = await readJsonLimited(request, 2_000_000);
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      throw new PublicApiError({
        httpStatus: 400,
        type: "validation_error",
        code: "invalid_request",
        message: "csv is required.",
      });
    }
    let identityAttestation = null;
    if (parsed.data.identity_prevalidated === true) {
      const att = parseIdentityAttestation(parsed.data.identity_attestation, {
        verifiedBy: ctx.apiKeyPrefix,
        source: "public_api_bulk",
      });
      if (!att.ok) {
        throw new PublicApiError({
          httpStatus: 400,
          type: "validation_error",
          code: att.reason,
          message: "identity_attestation is required when identity_prevalidated is true.",
        });
      }
      identityAttestation = att.value;
    }
    const job = await createBulkJob({
      orgId: ctx.orgId,
      actor: ctx.apiKeyPrefix,
      filename: "api.csv",
      bytes: Buffer.from(parsed.data.csv, "utf8"),
      sendInvites: parsed.data.send_invites !== false,
      identityPrevalidated: parsed.data.identity_prevalidated === true,
      identityAttestation,
    }).catch((e) => {
      rethrowArtAsPublic(e);
    });
    return NextResponse.json({ data: job }, { status: 202 });
  });
}
