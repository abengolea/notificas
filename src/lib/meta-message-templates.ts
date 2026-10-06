const META_GRAPH_HOST = "graph.facebook.com";
const META_GRAPH_VERSION = "v18.0";

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

export function templateHasUrlButton(components: unknown): boolean {
  if (!Array.isArray(components)) return false;
  for (const raw of components) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const type = String((raw as { type?: unknown }).type || "").toUpperCase();
    if (type !== "BUTTONS") continue;
    const buttons = (raw as { buttons?: unknown }).buttons;
    if (!Array.isArray(buttons)) continue;
    if (buttons.some((b) => String((b as { type?: unknown }).type || "").toUpperCase() === "URL")) {
      return true;
    }
  }
  return false;
}

export function countTemplatePlaceholders(body: string): number {
  let max = 0;
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

export function inferWaTemplateVariables(body: string): string[] {
  const n = countTemplatePlaceholders(body);
  if (n <= 0) return [];
  const looksLikeLink = /enlace|link|http|acced|lector/i.test(body);
  const vars: string[] = [];
  for (let i = 1; i <= n; i += 1) {
    if (i === 1) vars.push("nombre");
    else if (looksLikeLink && i === n) vars.push("url_lectura");
    else vars.push(`campo_${i}`);
  }
  return vars;
}

/** Mapeos {{N}} conocidos para templates que ya usamos con clientes. */
export const KNOWN_WA_TEMPLATE_VARS: Record<string, string[]> = {
  colegio_de_abogados_intimacion_matricula: ["nombre", "url_lectura"],
  colegio_de_abogados_san_nicolas: ["nombre", "tomo", "folio", "cuotas", "monto"],
};

export function variablesForApprovedTemplate(name: string, body: string): string[] {
  const known = KNOWN_WA_TEMPLATE_VARS[String(name || "").trim().toLowerCase()];
  if (known) return [...known];
  return inferWaTemplateVariables(body);
}

export function humanizeWaTemplateLabel(name: string): string {
  const s = String(name || "").replace(/_/g, " ").trim();
  if (!s) return "Template";
  return s.replace(/\b\p{L}/gu, (c) => c.toUpperCase()).slice(0, 80);
}

export function savedWaTemplateKey(name: string, language: string): string {
  return `${String(name || "").trim().toLowerCase()}::${String(language || "es_AR").trim().toLowerCase() || "es_ar"}`;
}

export function summarizeApprovedTemplates(list: unknown): Array<{
  id: string | null;
  name: string;
  language: string;
  status: string;
  body: string;
  urlButton: boolean;
  variableCount: number;
}> {
  const rows = Array.isArray(list) ? (list as MetaMessageTemplateListItem[]) : [];
  const out: Array<{
    id: string | null;
    name: string;
    language: string;
    status: string;
    body: string;
    urlButton: boolean;
    variableCount: number;
  }> = [];
  const seen = new Set<string>();
  for (const t of rows) {
    const status = String(t.status || "").toUpperCase();
    if (status && status !== "APPROVED") continue;
    const name = String(t.name || "").trim();
    if (!name) continue;
    const language = String(t.language || "es_AR").trim() || "es_AR";
    const key = `${name.toLowerCase()}::${language.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const body = extractTemplateBody(t);
    out.push({
      id: typeof (t as { id?: unknown }).id === "string" ? String((t as { id: string }).id) : null,
      name,
      language,
      status: status || "APPROVED",
      body,
      urlButton: templateHasUrlButton(t.components),
      variableCount: countTemplatePlaceholders(body),
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return out;
}

export async function listApprovedWhatsAppTemplates(input: {
  accessToken: string;
  wabaId: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<MetaMessageTemplateListItem[]> {
  const token = input.accessToken.trim();
  const waba = input.wabaId.trim();
  if (!token || !waba) return [];
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 12000;
  const collected: MetaMessageTemplateListItem[] = [];
  const qs = new URLSearchParams({
    fields: "id,name,language,status,components",
    status: "APPROVED",
    limit: "100",
  });
  let url: string | null =
    `https://${META_GRAPH_HOST}/${META_GRAPH_VERSION}/${encodeURIComponent(waba)}/message_templates?${qs.toString()}`;
  for (let page = 0; page < 5 && url; page += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as {
        data?: unknown;
        paging?: { next?: string };
        error?: { message?: string };
      };
      if (!res.ok) {
        console.warn("GET message_templates list:", res.status, data?.error || data);
        break;
      }
      if (Array.isArray(data.data)) {
        collected.push(...(data.data as MetaMessageTemplateListItem[]));
      }
      url = typeof data.paging?.next === "string" && data.paging.next.trim()
        ? data.paging.next
        : null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("GET message_templates list falló:", message);
      break;
    } finally {
      clearTimeout(timer);
    }
  }
  return collected;
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
