export type ResendEmailPublic = {
  id: string | null;
  lastEvent: string | null;
  createdAt: string | null;
  subject: string | null;
  from: string | null;
  to: string | null;
};

export type ResendEmailFetchResult = {
  ok: boolean;
  httpStatus: number;
  json: Record<string, unknown> | null;
};

const EMAIL_ID_RE = /^[A-Za-z0-9._-]+$/;

export function isSafeResendEmailId(id: string): boolean {
  return EMAIL_ID_RE.test(id) && id.length >= 8 && id.length <= 80;
}

function firstRecipient(to: unknown): string | null {
  if (typeof to === "string" && to.trim()) return to.trim();
  if (Array.isArray(to) && typeof to[0] === "string" && to[0].trim()) return to[0].trim();
  return null;
}

/** Solo campos públicos. Nunca html, text ni headers. */
export function pickResendEmailPublic(json: unknown): ResendEmailPublic | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  if (!id) return null;
  return {
    id,
    lastEvent: typeof o.last_event === "string" ? o.last_event : null,
    createdAt: typeof o.created_at === "string" ? o.created_at : null,
    subject: typeof o.subject === "string" ? o.subject : null,
    from: typeof o.from === "string" ? o.from : null,
    to: firstRecipient(o.to),
  };
}

export function createResendEmailFetcher(opts: {
  apiKey: string;
  fetchImpl?: typeof fetch;
}): (emailId: string) => Promise<ResendEmailFetchResult> {
  const fetchImpl = opts.fetchImpl || fetch;
  const apiKey = opts.apiKey.trim();
  return async (emailId: string) => {
    if (!isSafeResendEmailId(emailId)) {
      return { ok: false, httpStatus: 400, json: null };
    }
    const res = await fetchImpl(`https://api.resend.com/emails/${encodeURIComponent(emailId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: res.ok, httpStatus: res.status, json };
  };
}

export function lastEventClaim(lastEvent: string | null): string {
  switch (lastEvent) {
    case "delivered":
      return "Resend informa last_event=delivered en la consulta actual: el servidor de correo del destinatario aceptó el mensaje. No afirma que esté en la bandeja de entrada ni que una persona lo haya leído.";
    case "sent":
      return "Resend informa last_event=sent: aceptó el mensaje para entrega. No afirma llegada al buzón.";
    case "bounced":
    case "failed":
    case "suppressed":
      return `Resend informa last_event=${lastEvent}: el mensaje no llegó al buzón.`;
    case "complained":
      return "Resend informa last_event=complained: marca de spam. No identifica al lector.";
    case "opened":
      return "Resend informa last_event=opened: señal técnica de pixel o proxy. No es lectura fehaciente.";
    case "clicked":
      return "Resend informa last_event=clicked: señal técnica de clic. No es lectura fehaciente.";
    case "delivery_delayed":
      return "Resend informa last_event=delivery_delayed: demora temporal. No afirma entrega.";
    default:
      return lastEvent
        ? `Resend informa last_event=${lastEvent}. No se interpreta como lectura ni como bandeja de entrada.`
        : "Resend no informó last_event en esta consulta.";
  }
}
