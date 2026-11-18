import {
  countTemplatePlaceholders,
  extractTemplateBody,
  extractTemplateHeader,
  type MetaMessageTemplateListItem,
} from "@/lib/meta-message-templates";

/**
 * ¿El template de Meta tiene un botón con enlace variable (`https://…/{{1}}`)? Un botón con URL fija no recibe
 * parámetros: mandarle uno hace que Meta rechace el mensaje.
 */
export function templateHasDynamicUrlButton(components: unknown): boolean {
  if (!Array.isArray(components)) return false;
  for (const raw of components) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    if (String((raw as { type?: unknown }).type || "").toUpperCase() !== "BUTTONS") continue;
    const buttons = (raw as { buttons?: unknown }).buttons;
    if (!Array.isArray(buttons)) continue;
    for (const b of buttons) {
      if (!b || typeof b !== "object") continue;
      const btn = b as { type?: unknown; url?: unknown };
      if (String(btn.type || "").toUpperCase() === "URL" && /\{\{\s*\d+\s*\}\}/.test(String(btn.url || ""))) {
        return true;
      }
    }
  }
  return false;
}

const URL_FIELDS = new Set(["url_lectura", "boton_url"]);

export type WaTemplateShapeCheck = {
  ok: boolean;
  problems: string[];
  message: string;
};

function describeSent(fields: string[]): string {
  if (!fields.length) return "ninguna";
  return fields.map((f, i) => `{{${i + 1}}}→${f.startsWith("=") ? "texto fijo" : f}`).join(", ");
}

/**
 * Cada {{N}} del cuerpo de Meta necesita una variable en la campaña. Si falta una, Meta rechaza el WhatsApp (#132000)
 * y, cuando el correo lleva el texto de la plantilla, el mail sale con «{{3}}» a la vista.
 * Devuelve el problema en texto, o "" si la cantidad coincide.
 */
export function describeBodyVariableMismatch(input: {
  body: string;
  variables: string[];
  urlButton: boolean;
  templateName?: string;
}): string {
  const name = String(input.templateName || "").trim() || "el template";
  const bodyCount = countTemplatePlaceholders(input.body);
  const sentFields = input.variables.filter((f) => !(input.urlButton && URL_FIELDS.has(String(f).trim())));
  if (sentFields.length === bodyCount) return "";
  const hint =
    bodyCount > sentFields.length
      ? ` Falta definir qué dato va en ${missingPlaceholders(sentFields.length, bodyCount)}: agregalo en Template (una variable o un texto fijo).`
      : " Sobran variables: dejá solo una por cada {{N}} del cuerpo.";
  return `El cuerpo de ${name} en Meta tiene ${bodyCount} variable${bodyCount === 1 ? "" : "s"} y la campaña manda ${sentFields.length} (${describeSent(sentFields)}).${hint}`;
}

function missingPlaceholders(from: number, to: number): string {
  const out: string[] = [];
  for (let n = from + 1; n <= to; n += 1) out.push(`{{${n}}}`);
  return out.join(", ");
}

/**
 * Compara lo que la campaña va a mandar con el template aprobado en Meta. Si no coinciden, Meta rechaza cada
 * mensaje (#132000 «Number of parameters does not match»): conviene frenar antes del primer envío.
 */
export function checkWaTemplateShape(input: {
  template: MetaMessageTemplateListItem;
  /** Variables del cuerpo en el orden de {{1}}, {{2}}, … tal como las guarda la campaña. */
  variables: string[];
  /** La campaña manda el link del lector en el botón del template (no en el cuerpo). */
  urlButton: boolean;
}): WaTemplateShapeCheck {
  const problems: string[] = [];
  const { template } = input;
  const name = String(template.name || "").trim() || "el template";

  const status = String(template.status || "").toUpperCase();
  if (status && status !== "APPROVED") {
    problems.push(`${name} está en estado «${status}» en Meta: todavía no se puede enviar.`);
  }

  const metaButton = templateHasDynamicUrlButton(template.components);

  const mismatch = describeBodyVariableMismatch({
    body: extractTemplateBody(template),
    variables: input.variables,
    urlButton: input.urlButton,
    templateName: name,
  });
  if (mismatch) {
    const buttonHint =
      input.urlButton && !metaButton && input.variables.some((f) => URL_FIELDS.has(String(f).trim()))
        ? " Desactivá el botón de enlace: el link del lector va dentro del cuerpo."
        : "";
    problems.push(`${mismatch}${buttonHint}`);
  }

  const headerCount = countTemplatePlaceholders(extractTemplateHeader(template));
  if (headerCount > 0) {
    problems.push(
      `${name} tiene variables en el encabezado y Notificas solo manda variables en el cuerpo. Usá un template sin variables en el encabezado.`
    );
  }

  if (metaButton && !input.urlButton) {
    problems.push(
      `${name} tiene un botón con enlace variable y la campaña no lo activa: Meta pide su parámetro. Activá el botón de enlace en Template.`
    );
  } else if (!metaButton && input.urlButton) {
    problems.push(`La campaña manda un botón de enlace, pero ${name} no tiene un botón con enlace variable en Meta.`);
  }

  return { ok: problems.length === 0, problems, message: problems.join(" ") };
}
