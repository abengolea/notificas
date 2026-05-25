import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { LegacyMigrationStateCode } from "@/lib/legacy-migration";
import { getLegacyMigrationStateCode } from "@/lib/legacy-migration-state-server";

const bodySchema = z.object({
  email: z.string().email(),
});

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    const email = normalizeEmail(parsed.data.email);

    const state = await getLegacyMigrationStateCode(email);
    if (!state.ok) {
      if (state.reason === "auth_user_not_found") {
        return NextResponse.json({ code: "OK" as LegacyMigrationStateCode });
      }
      console.error("[legacy-migration-state] auth", state.cause);
      return NextResponse.json({ error: "No se pudo consultar el estado" }, { status: 500 });
    }

    return NextResponse.json({ code: state.code });
  } catch (e) {
    console.error("[legacy-migration-state]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
