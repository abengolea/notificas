import { NextRequest, NextResponse } from "next/server";
import { assertEmpresaArt } from "@/lib/art/empresa-auth";
import { createBulkJob, getBulkJob } from "@/lib/art/bulk";
import { parseIdentityAttestation } from "@/lib/art/identity-attestation";
import { artCaughtErrorResponse } from "@/lib/art/http";

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId") || "";
  const jobId = request.nextUrl.searchParams.get("jobId") || "";
  const gate = await assertEmpresaArt(request, orgId);
  if (gate.errorResponse) return gate.errorResponse;
  if (!jobId) return NextResponse.json({ error: "jobId requerido" }, { status: 400 });
  const job = await getBulkJob(orgId, jobId);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ job });
}

export async function POST(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId") || "";
  const gate = await assertEmpresaArt(request, orgId);
  if (gate.errorResponse) return gate.errorResponse;
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "multipart requerido" }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file requerido" }, { status: 400 });
  const sendInvites = String(form.get("sendInvites") || "true") !== "false";
  const identityPrevalidated = String(form.get("identityPrevalidated") || "false") === "true";
  let identityAttestation = null;
  if (identityPrevalidated) {
    const parsedAtt = parseIdentityAttestation(
      {
        identityVerificationMethod: String(form.get("identityVerificationMethod") || "ART_INTERNAL_KYC"),
        identitySource: String(form.get("identitySource") || "bulk_import"),
        identityExternalReference: String(form.get("identityExternalReference") || ""),
        identityVerifiedBy: String(form.get("identityVerifiedBy") || gate.decoded!.email || gate.decoded!.uid),
        identityAssuranceLevel: String(form.get("identityAssuranceLevel") || "ART_DECLARED"),
      },
      { verifiedBy: gate.decoded!.email || gate.decoded!.uid, source: "bulk_import" }
    );
    if (!parsedAtt.ok) {
      return NextResponse.json({ error: parsedAtt.reason }, { status: 400 });
    }
    identityAttestation = parsedAtt.value;
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const job = await createBulkJob({
      orgId,
      actor: gate.decoded!.email || gate.decoded!.uid,
      filename: file.name,
      bytes,
      sendInvites,
      identityPrevalidated,
      identityAttestation,
    });
    return NextResponse.json(job, { status: 202 });
  } catch (e) {
    const mapped = artCaughtErrorResponse(e);
    if (mapped) return mapped;
    throw e;
  }
}
