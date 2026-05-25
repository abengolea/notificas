import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { LEGACY_MIGRATION_SOURCE, type LegacyMigrationStateCode } from "@/lib/legacy-migration";

/** Email ya normalizado (trim + lower). */
export async function getLegacyMigrationStateCode(
  email: string,
): Promise<
  | { ok: true; code: LegacyMigrationStateCode }
  | { ok: false; reason: "auth_user_not_found" }
  | { ok: false; reason: "auth_lookup_failed"; cause: unknown }
> {
  const auth = getAdminAuth();
  const db = getAdminDb();

  let record;
  try {
    record = await auth.getUserByEmail(email);
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String((e as { code?: string }).code)
        : "";
    if (code === "auth/user-not-found") {
      return { ok: false, reason: "auth_user_not_found" };
    }
    return { ok: false, reason: "auth_lookup_failed", cause: e };
  }

  const snap = await db.collection("users").doc(record.uid).get();
  if (!snap.exists) {
    return { ok: true, code: "ACCOUNT_EXISTS" };
  }

  const d = snap.data() as Record<string, unknown> | undefined;
  const pending =
    d?.migrationSource === LEGACY_MIGRATION_SOURCE && d?.mustSetPassword === true;
  if (pending) {
    return { ok: true, code: "MIGRATED_PENDING_PASSWORD" };
  }
  return { ok: true, code: "ACCOUNT_EXISTS" };
}
