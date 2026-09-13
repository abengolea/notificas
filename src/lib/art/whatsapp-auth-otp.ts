import { isSafeMetaObjectId, META_GRAPH_HOST, META_GRAPH_TIMEOUT_MS, META_GRAPH_VERSION } from "@/lib/meta-graph-client";
import { getWhatsAppAccessToken } from "@/lib/meta-access-token";
import { toWhatsAppPhone } from "@/lib/parse-campaign-csv";

const OTP_RE = /^\d{4,8}$/;
const DEFAULT_TEMPLATE = "notificas_verificacion_identidad";

export function artWhatsAppOtpEnabled(): boolean {
  const raw = (process.env.ART_WHATSAPP_OTP_ENABLED || "").trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") return false;
  return true;
}

export function artWhatsAppOtpTemplateName(): string {
  return (process.env.ART_WHATSAPP_OTP_TEMPLATE || DEFAULT_TEMPLATE).trim() || DEFAULT_TEMPLATE;
}

/** Spanish AUTH en Meta suele ser `es`. Si falla, se prueba `es_AR`. */
export function artWhatsAppOtpLanguages(): string[] {
  const primary = (process.env.ART_WHATSAPP_OTP_LANG || "es").trim() || "es";
  const fallback = primary === "es" ? "es_AR" : primary === "es_AR" ? "es" : "es";
  return primary === fallback ? [primary] : [primary, fallback];
}

export function whatsAppOtpToDigits(phone: string | undefined | null): string | null {
  const e164 = toWhatsAppPhone(String(phone || ""));
  if (!e164) return null;
  const digits = e164.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

export function buildWhatsAppAuthOtpPayload(input: {
  to: string;
  code: string;
  templateName: string;
  language: string;
  includeCopyCodeButton?: boolean;
}): Record<string, unknown> {
  const components: Array<Record<string, unknown>> = [
    {
      type: "body",
      parameters: [{ type: "text", text: input.code }],
    },
  ];
  if (input.includeCopyCodeButton !== false) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: input.code }],
    });
  }
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "template",
    template: {
      name: input.templateName,
      language: { code: input.language },
      components,
    },
  };
}

export async function resolveArtWhatsAppOtpCredentials(): Promise<{
  token: string;
  phoneNumberId: string;
} | null> {
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID || "").trim();
  if (!isSafeMetaObjectId(phoneNumberId)) return null;
  const token =
    (await getWhatsAppAccessToken()) ||
    (process.env.WHATSAPP_TOKEN || "").trim() ||
    "";
  if (!token) return null;
  return { token, phoneNumberId };
}

type GraphError = { code: number | null; message: string };

function parseGraphError(json: unknown): GraphError {
  if (!json || typeof json !== "object" || Array.isArray(json)) return { code: null, message: "" };
  const err = (json as { error?: { code?: unknown; message?: unknown } }).error;
  if (!err || typeof err !== "object") return { code: null, message: "" };
  const code = typeof err.code === "number" ? err.code : null;
  const message = typeof err.message === "string" ? err.message : "";
  return { code, message };
}

function shouldRetryWithoutButton(err: GraphError): boolean {
  if (err.code === 132000 || err.code === 132005 || err.code === 132012) return true;
  return /button|component/i.test(err.message);
}

function shouldRetryLanguage(err: GraphError): boolean {
  return err.code === 132001 || /translation|language|does not exist/i.test(err.message);
}

export async function sendWhatsAppAuthOtp(input: {
  toPhone: string;
  code: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; waMessageId: string | null; language: string } | { ok: false; error: string }> {
  if (!artWhatsAppOtpEnabled()) return { ok: false, error: "whatsapp_otp_disabled" };
  const code = String(input.code || "").trim();
  if (!OTP_RE.test(code)) return { ok: false, error: "invalid_otp_format" };
  const to = whatsAppOtpToDigits(input.toPhone);
  if (!to) return { ok: false, error: "invalid_phone" };
  const creds = await resolveArtWhatsAppOtpCredentials();
  if (!creds) return { ok: false, error: "whatsapp_unconfigured" };

  const templateName = artWhatsAppOtpTemplateName();
  const languages = artWhatsAppOtpLanguages();
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = `https://${META_GRAPH_HOST}/${META_GRAPH_VERSION}/${creds.phoneNumberId}/messages`;

  let lastError = "whatsapp_otp_failed";
  for (const language of languages) {
    for (const includeCopyCodeButton of [true, false]) {
      const payload = buildWhatsAppAuthOtpPayload({
        to,
        code,
        templateName,
        language,
        includeCopyCodeButton,
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), META_GRAPH_TIMEOUT_MS);
      try {
        const res = await fetchImpl(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${creds.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
          redirect: "error",
        });
        const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (res.ok) {
          const messages = json?.messages;
          const first = Array.isArray(messages) ? messages[0] : null;
          const waMessageId =
            first && typeof first === "object" && typeof (first as { id?: unknown }).id === "string"
              ? String((first as { id: string }).id)
              : null;
          return { ok: true, waMessageId, language };
        }
        const err = parseGraphError(json);
        lastError = err.code ? `meta_${err.code}` : `whatsapp_http_${res.status}`;
        console.warn("[art] WhatsApp AUTH OTP rejected", {
          status: res.status,
          error: lastError,
          language,
          templateName,
        });
        if (includeCopyCodeButton && shouldRetryWithoutButton(err)) continue;
        if (shouldRetryLanguage(err)) break;
        return { ok: false, error: lastError };
      } catch (e) {
        const timedOut = e instanceof Error && (e.name === "AbortError" || /timeout|aborted/i.test(e.message));
        lastError = timedOut ? "whatsapp_timeout" : "whatsapp_otp_failed";
        return { ok: false, error: lastError };
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return { ok: false, error: lastError };
}
