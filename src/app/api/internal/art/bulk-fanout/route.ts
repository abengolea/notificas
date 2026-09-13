import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { ART_COLLECTIONS } from "@/lib/art/collections";
import { upsertFromBulkRow } from "@/lib/art/store";
import { createInvitation } from "@/lib/art/invite";
import { startOrApplyIdentity } from "@/lib/art/identity-flow";
import { parseIdentityAttestation, type IdentityAttestation } from "@/lib/art/identity-attestation";
import type { ArtBulkRowParsed } from "@/lib/art/bulk-parse";
import { artModuleEnabled } from "@/lib/art/enabled";
import { requireArtOrg } from "@/lib/art/http";

function verifyWorkerSecret(request: NextRequest): boolean {
  const secret = (process.env.CAMPAIGN_WORKER_SECRET || "").trim();
  if (!secret) return false;
  return (request.headers.get("X-Worker-Secret") || "").trim() === secret;
}

export async function POST(request: NextRequest) {
  if (!artModuleEnabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });
  if (!verifyWorkerSecret(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json()) as { jobId?: string; orgId?: string; chunkId?: string };
  if (!body.jobId || !body.orgId || !body.chunkId) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const orgDenied = requireArtOrg(body.orgId);
  if (orgDenied) return orgDenied;
  const db = getAdminDb();
  const chunkSnap = await db.collection(ART_COLLECTIONS.bulkRows).doc(body.chunkId).get();
  if (!chunkSnap.exists) return NextResponse.json({ skipped: true });
  const chunk = chunkSnap.data()!;
  if (String(chunk.orgId) !== body.orgId) return NextResponse.json({ error: "tenant" }, { status: 403 });
  const jobSnap = await db.collection(ART_COLLECTIONS.bulkJobs).doc(body.jobId).get();
  const job = jobSnap.data() || {};
  let attestation: IdentityAttestation | null = null;
  if (job.identityPrevalidated === true) {
    const parsed = parseIdentityAttestation(job.identityAttestation, {
      verifiedBy: String(job.actor || ""),
      source: "bulk_import",
    });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.reason }, { status: 400 });
    }
    attestation = parsed.value;
  }
  const orgSnap = await db.collection("organizations").doc(body.orgId).get();
  const orgName = String(orgSnap.data()?.nombre || "ART");
  const rows = Array.isArray(chunk.rows) ? (chunk.rows as ArtBulkRowParsed[]) : [];
  let processed = 0;
  let invited = 0;
  let errors = 0;
  for (const row of rows) {
    try {
      const { recipient } = await upsertFromBulkRow(body.orgId, row, attestation);
      if (attestation) {
        await startOrApplyIdentity({
          orgId: body.orgId,
          recipient,
          attestation,
          actor: String(job.actor || "bulk"),
        });
      }
      processed++;
      if (job.sendInvites !== false) {
        await createInvitation({
          orgId: body.orgId,
          orgName,
          recipient,
          actor: String(job.actor || "bulk"),
          send: true,
        });
        invited++;
      }
    } catch {
      errors++;
    }
  }
  await db.collection(ART_COLLECTIONS.bulkJobs).doc(body.jobId).update({
    processed: FieldValue.increment(processed),
    invited: FieldValue.increment(invited),
    errors: FieldValue.increment(errors),
    pending: FieldValue.increment(-rows.length),
    status: "running",
    updatedAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ processed, invited, errors });
}
