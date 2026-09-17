import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_COMPANIES, MARKETING_SOURCES } from "../collections";
import { DEFAULT_MARKETING_WORKSPACE_ID } from "../workspace";

export type CompanyMigrationIndexCheck = {
  id: string;
  collection: string;
  fields: string;
  status: "ready" | "missing" | "building" | "unknown";
  detail?: string;
};

export type CompanyMigrationIndexPreflight = {
  projectId: string;
  ready: boolean;
  checks: CompanyMigrationIndexCheck[];
};

const REQUIRED_PROBES: Array<{
  id: string;
  collection: string;
  fields: string;
  run: (workspaceId: string) => FirebaseFirestore.Query;
}> = [
  {
    id: "companies_normalizedDomain",
    collection: MARKETING_COMPANIES,
    fields: "workspaceId + normalizedDomain",
    run: (workspaceId) =>
      getAdminDb()
        .collection(MARKETING_COMPANIES)
        .where("workspaceId", "==", workspaceId)
        .where("normalizedDomain", "==", "__crm_companies_v1_preflight__")
        .limit(1),
  },
  {
    id: "companies_normalizedName_country",
    collection: MARKETING_COMPANIES,
    fields: "workspaceId + normalizedName + countryCode",
    run: (workspaceId) =>
      getAdminDb()
        .collection(MARKETING_COMPANIES)
        .where("workspaceId", "==", workspaceId)
        .where("normalizedName", "==", "__crm_companies_v1_preflight__")
        .where("countryCode", "==", "AR")
        .limit(1),
  },
  {
    id: "sources_workspace_createdAt",
    collection: MARKETING_SOURCES,
    fields: "workspaceId + createdAt DESC",
    run: (workspaceId) =>
      getAdminDb()
        .collection(MARKETING_SOURCES)
        .where("workspaceId", "==", workspaceId)
        .orderBy("createdAt", "desc")
        .limit(1),
  },
];

function classifyIndexError(message: string): "missing" | "building" | "unknown" {
  const lower = message.toLowerCase();
  if (lower.includes("currently building") || lower.includes("index is currently")) return "building";
  if (lower.includes("requires an index") || lower.includes("failed_precondition")) return "missing";
  return "unknown";
}

export async function preflightCompanyMigrationIndexes(input?: {
  workspaceId?: string;
  projectId?: string;
}): Promise<CompanyMigrationIndexPreflight> {
  const workspaceId = input?.workspaceId || DEFAULT_MARKETING_WORKSPACE_ID;
  const projectId =
    input?.projectId ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "";
  const checks: CompanyMigrationIndexCheck[] = [];
  for (const probe of REQUIRED_PROBES) {
    try {
      await probe.run(workspaceId).get();
      checks.push({
        id: probe.id,
        collection: probe.collection,
        fields: probe.fields,
        status: "ready",
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      checks.push({
        id: probe.id,
        collection: probe.collection,
        fields: probe.fields,
        status: classifyIndexError(detail),
        detail: detail.slice(0, 240),
      });
    }
  }
  return {
    projectId,
    ready: checks.every((check) => check.status === "ready"),
    checks,
  };
}

export function assertCompanyMigrationIndexesReady(preflight: CompanyMigrationIndexPreflight): void {
  if (preflight.ready) return;
  const pending = preflight.checks.filter((check) => check.status !== "ready");
  throw new Error(
    `APPLY_BLOCKED: required indexes not ready (${pending
      .map((c) => `${c.collection} ${c.fields}=${c.status}`)
      .join("; ")}). Deploy with: firebase deploy --only firestore:indexes --project ${
      preflight.projectId || "notificas-f9953"
    }`,
  );
}

export function formatIndexPreflight(preflight: CompanyMigrationIndexPreflight): string {
  const lines = [`Required indexes: ${preflight.ready ? "READY" : "NOT READY"}`];
  for (const check of preflight.checks) {
    lines.push(`- ${check.collection} [${check.fields}]: ${check.status.toUpperCase()}`);
  }
  return lines.join("\n");
}
