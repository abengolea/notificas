/** Campaña que todavía no despachó ningún envío (borrador o cancelada vacía). */
export function isUnsentCampaign(data: {
  estado?: unknown;
  stats?: { enviados?: unknown } | null;
}): boolean {
  const estado = String(data.estado || "borrador");
  const enviados = typeof data.stats?.enviados === "number" ? data.stats.enviados : 0;
  if (enviados > 0) return false;
  return estado === "borrador" || estado === "cancelada";
}

export const UNSENT_EDIT_ERROR =
  "Solo se puede editar una campaña que todavía no se envió.";

/**
 * Template de WhatsApp: se puede cambiar si no hay envíos exitosos
 * (borrador, cancelada, o completada que solo tuvo errores).
 */
export function canEditWhatsAppTemplate(data: {
  estado?: unknown;
  stats?: { enviados?: unknown } | null;
}): boolean {
  const estado = String(data.estado || "borrador");
  if (estado === "enviando" || estado === "pausada") return false;
  const enviados = typeof data.stats?.enviados === "number" ? data.stats.enviados : 0;
  return enviados === 0;
}

export const WA_TEMPLATE_EDIT_ERROR =
  "Solo se puede editar el template de WhatsApp si todavía no hubo envíos exitosos.";

export function toDatetimeLocalValue(ts: unknown): string {
  let d: Date | null = null;
  if (!ts) return "";
  if (typeof ts === "string") d = new Date(ts);
  else if (ts instanceof Date) d = ts;
  else if (typeof ts === "object") {
    const o = ts as { seconds?: number; _seconds?: number; toDate?: () => Date };
    if (typeof o.toDate === "function") d = o.toDate();
    else {
      const secs = o.seconds ?? o._seconds;
      if (secs != null) d = new Date(secs * 1000);
    }
  }
  if (!d || Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
