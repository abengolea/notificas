import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { enqueueTaskSafe } from "@/lib/art/enqueue";
import { ART_COLLECTIONS } from "@/lib/art/collections";
import { newArtBulkJobId } from "@/lib/art/ids";
import { parseCsvArtBulk, type ArtBulkRowParsed } from "@/lib/art/bulk-parse";
import type { IdentityAttestation } from "@/lib/art/identity-attestation";
import * as XLSX from "xlsx";
import { assertPilotBulkLimit, assertPilotRecipientAllowed, throwArtCode } from "@/lib/art/pilot";

export async function createBulkJob(input: {
  orgId: string;
  actor: string;
  filename: string;
  bytes: Buffer;
  sendInvites: boolean;
  identityPrevalidated: boolean;
  identityAttestation?: IdentityAttestation | null;
}): Promise<{ jobId: string; total: number; errors: number }> {
  if (input.identityPrevalidated && !input.identityAttestation) {
    throw Object.assign(new Error("identity_attestation_required"), {
      code: "identity_attestation_required",
      httpStatus: 400,
    });
  }
  const name = input.filename.toLowerCase();
  let parsed;
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const wb = XLSX.read(input.bytes, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    parsed = parseCsvArtBulk(csv);
  } else {
    parsed = parseCsvArtBulk(input.bytes.toString("utf8"));
  }
  throwArtCode(assertPilotBulkLimit(parsed.rows.length, input.orgId));
  for (const row of parsed.rows) {
    throwArtCode(assertPilotRecipientAllowed({ orgId: input.orgId, email: row.email, phone: row.phone }));
  }
  const jobId = newArtBulkJobId();
  const db = getAdminDb();
  await db.collection(ART_COLLECTIONS.bulkJobs).doc(jobId).set({
    jobId,
    orgId: input.orgId,
    actor: input.actor,
    filename: input.filename,
    sendInvites: input.sendInvites,
    identityPrevalidated: input.identityPrevalidated,
    identityAttestation: input.identityAttestation || null,
    total: parsed.rows.length,
    processed: 0,
    invited: 0,
    adhered: 0,
    pending: parsed.rows.length,
    errors: parsed.errors.length,
    revoked: 0,
    parseErrors: parsed.errors.slice(0, 50),
    status: "queued",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const chunks = chunk(parsed.rows, 50);
  for (let i = 0; i < chunks.length; i++) {
    await db.collection(ART_COLLECTIONS.bulkRows).doc(`${jobId}_${i}`).set({
      jobId,
      orgId: input.orgId,
      offset: i * 50,
      rows: chunks[i],
    });
    await enqueueTaskSafe("/api/internal/art/bulk-fanout", { jobId, orgId: input.orgId, chunkId: `${jobId}_${i}` }, `art-bulk-${jobId}-${i}`);
  }
  return { jobId, total: parsed.rows.length, errors: parsed.errors.length };
}

export async function getBulkJob(orgId: string, jobId: string) {
  const snap = await getAdminDb().collection(ART_COLLECTIONS.bulkJobs).doc(jobId).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  if (String(d.orgId) !== orgId) return null;
  return { id: snap.id, ...d };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export type { ArtBulkRowParsed };
