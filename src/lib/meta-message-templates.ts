import { META_GRAPH_HOST, META_GRAPH_VERSION } from "@/lib/meta-graph-client";

export type MetaMessageTemplateListItem = {
  name?: unknown;
  language?: unknown;
  status?: unknown;
  components?: unknown;
};

export function pickApprovedTemplate(
  list: unknown,
  templateLang: string | undefined | null
): MetaMessageTemplateListItem | null {
  const rows = Array.isArray(list) ? (list as MetaMessageTemplateListItem[]) : [];
  if (!rows.length) return null;
  const lang = String(templateLang || "es_AR").toLowerCase();
  const approved = rows.filter((t) => {
    const st = String(t.status || "").toUpperCase();
    return !st || st === "APPROVED";
  });
  const pool = approved.length ? approved : rows;
  return pool.find((t) => String(t.language || "").toLowerCase() === lang) || pool[0] || null;
}

function componentText(components: unknown, type: string): string {
  if (!Array.isArray(components)) return "";
  const want = type.toUpperCase();
  const block = components.find((c) => {
    if (!c || typeof c !== "object" || Array.isArray(c)) return false;
    return String((c as { type?: unknown }).type || "").toUpperCase() === want;
  }) as { text?: unknown; format?: unknown } | undefined;
  if (!block) return "";
  if (want === "HEADER" && String(block.format || "TEXT").toUpperCase() !== "TEXT") return "";
  return String(block.text || "").trim();
}

export function extractTemplateBody(template: MetaMessageTemplateListItem | null | undefined): string {
  if (!template) return "";
  return componentText(template.components, "BODY");
}

export function extractTemplateHeader(template: MetaMessageTemplateListItem | null | undefined): string {
  if (!template) return "";
  return componentText(template.components, "HEADER");
}

export function extractTemplateFooter(template: MetaMessageTemplateListItem | null | undefined): string {
  if (!template) return "";
  return componentText(template.components, "FOOTER");
}

export async function fetchApprovedWhatsAppTemplate(input: {
  accessToken: string;
  wabaId: string;
  templateName: string;
  templateLang?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<MetaMessageTemplateListItem | null> {
  const token = input.accessToken.trim();
  const waba = input.wabaId.trim();
  const name = input.templateName.trim();
  if (!token || !waba || !name) return null;
  const qs = new URLSearchParams({
    name,
    fields: "id,name,language,status,components",
    limit: "50",
  });
  const url = `https://${META_GRAPH_HOST}/${META_GRAPH_VERSION}/${encodeURIComponent(waba)}/message_templates?${qs.toString()}`;
  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 8000);
  try {
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as { data?: unknown; error?: { message?: string } };
    if (!res.ok) {
      console.warn("GET message_templates:", res.status, data?.error || data);
      return null;
    }
    return pickApprovedTemplate(data?.data, input.templateLang);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("GET message_templates falló:", message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
