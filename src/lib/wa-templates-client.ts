import { auth } from "@/lib/firebase";
import type { SavedWaTemplate } from "@/lib/types";

export type WaTemplatesAuthMode = "empresa" | "admin";

async function waitFirebaseUser() {
  return new Promise<typeof auth.currentUser>((resolve) => {
    const unsub = auth.onAuthStateChanged((u) => {
      unsub();
      resolve(u);
    });
  });
}

async function waTemplatesFetch(mode: WaTemplatesAuthMode, url: string, init?: RequestInit) {
  if (mode === "admin") {
    return fetch(url, { ...init, credentials: "include" });
  }
  const user = auth.currentUser ?? (await waitFirebaseUser());
  if (!user) throw new Error("Sin sesión");
  const token = await user.getIdToken();
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
  });
}

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (typeof body.error === "string") return body.error;
  return `Error ${res.status}`;
}

export async function listSavedWaTemplates(
  mode: WaTemplatesAuthMode,
  orgId: string
): Promise<SavedWaTemplate[]> {
  const res = await waTemplatesFetch(mode, `/api/wa-templates?orgId=${encodeURIComponent(orgId)}`);
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { templates?: SavedWaTemplate[] };
  return Array.isArray(data.templates) ? data.templates : [];
}

export async function createSavedWaTemplate(
  mode: WaTemplatesAuthMode,
  input: {
    orgId: string;
    label: string;
    templateName: string;
    templateLang: string;
    templateVariables: string[];
    urlButton: boolean;
  }
): Promise<string> {
  const res = await waTemplatesFetch(mode, "/api/wa-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("No se pudo guardar");
  return data.id;
}

export async function updateSavedWaTemplate(
  mode: WaTemplatesAuthMode,
  templateId: string,
  input: {
    label?: string;
    templateName?: string;
    templateLang?: string;
    templateVariables?: string[];
    urlButton?: boolean;
  }
): Promise<void> {
  const res = await waTemplatesFetch(mode, `/api/wa-templates/${templateId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function deleteSavedWaTemplate(mode: WaTemplatesAuthMode, templateId: string): Promise<void> {
  const res = await waTemplatesFetch(mode, `/api/wa-templates/${templateId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readError(res));
}
