import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/public-api/api-keys";
import { PUBLIC_API_SCOPES } from "@/lib/public-api/scopes";

const createSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1).max(80),
  environment: z.enum(["live", "test"]),
  scopes: z.array(z.enum(PUBLIC_API_SCOPES)).optional(),
});

function serializeKey(row: Awaited<ReturnType<typeof listApiKeys>>[number]) {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    prefix: row.prefix,
    environment: row.environment,
    scopes: row.scopes,
    status: row.status,
    createdAt: row.createdAt && typeof (row.createdAt as { toDate?: () => Date }).toDate === "function"
      ? (row.createdAt as { toDate: () => Date }).toDate().toISOString()
      : null,
    lastUsedAt:
      row.lastUsedAt && typeof (row.lastUsedAt as { toDate?: () => Date }).toDate === "function"
        ? (row.lastUsedAt as { toDate: () => Date }).toDate().toISOString()
        : null,
  };
}

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const orgId = request.nextUrl.searchParams.get("orgId") || "";
  if (!orgId) return NextResponse.json({ error: "orgId requerido" }, { status: 400 });
  try {
    const keys = await listApiKeys(orgId);
    return NextResponse.json({ keys: keys.map(serializeKey) });
  } catch (e) {
    console.error("GET /api/admin/api-keys", e);
    return NextResponse.json({ error: "Error al listar API keys" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const orgSnap = await getAdminDb().collection("organizations").doc(parsed.data.orgId).get();
    if (!orgSnap.exists) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });

    const created = await createApiKey({
      orgId: parsed.data.orgId,
      name: parsed.data.name,
      environment: parsed.data.environment,
      scopes: parsed.data.scopes,
      createdBy: "admin",
    });
    return NextResponse.json({
      key: serializeKey(created.record),
      secret: created.secret,
    });
  } catch (e) {
    console.error("POST /api/admin/api-keys", e);
    return NextResponse.json({ error: "Error al crear API key" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const keyId = request.nextUrl.searchParams.get("keyId") || "";
    const orgId = request.nextUrl.searchParams.get("orgId") || undefined;
    if (!keyId) return NextResponse.json({ error: "keyId requerido" }, { status: 400 });
    await revokeApiKey({ keyId, orgId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = typeof (e as { httpStatus?: number }).httpStatus === "number" ? (e as { httpStatus: number }).httpStatus : 500;
    const message = e instanceof Error ? e.message : "Error al revocar";
    return NextResponse.json({ error: message }, { status });
  }
}
