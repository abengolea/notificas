#!/usr/bin/env node
/**
 * Genera o revoca una API Key de la API pública v1.
 *
 *   npx tsx scripts/create-api-key.ts --orgId ORG_ID --name "CRM" --env live
 *   npx tsx scripts/create-api-key.ts --revoke key_01J… --orgId ORG_ID
 *
 * Requiere .env.local con credenciales Admin (igual que el resto de scripts).
 */

import path from "path";
import { config } from "dotenv";

config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const { createApiKey, revokeApiKey } = await import("../src/lib/public-api/api-keys");

  const revokeId = get("--revoke");
  const orgId = get("--orgId");
  if (revokeId) {
    if (!orgId) {
      console.error("--orgId es requerido para revocar");
      process.exit(1);
    }
    await revokeApiKey({ keyId: revokeId, orgId });
    console.log("Revocada", revokeId);
    return;
  }

  if (!orgId) {
    console.error("Uso: npx tsx scripts/create-api-key.ts --orgId ORG_ID --name NAME --env live|test");
    process.exit(1);
  }
  const created = await createApiKey({
    orgId,
    name: get("--name") || "default",
    environment: get("--env") === "test" ? "test" : "live",
    createdBy: "script",
  });
  console.log("id:", created.record.id);
  console.log("prefix:", created.record.prefix);
  console.log("secret (copiá ahora, no se vuelve a mostrar):");
  console.log(created.secret);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
