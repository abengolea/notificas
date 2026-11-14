import { isWaLiteralVar, isWaTemplateVarEmpty, waLiteralText } from "@/lib/wa-template-fields";

/** Variables que el sistema completa solo: nunca dependen de una columna del CSV. */
const AUTO_FIELDS = new Set(["remitente", "empresa", "url_lectura", "boton_url"]);

/** Un campo "campo_N" es el marcador de "todavía no elegiste qué dato va acá". */
export function isWaPlaceholderField(field: string | undefined | null): boolean {
  return /^campo_\d+$/.test(String(field || "").trim());
}

type RowLike = Record<string, unknown>;

function text(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

/** Valor que recibiría Meta para ese campo, igual que functions/wa-template-vars.js (sin el remitente ni el link). */
export function resolveWaFieldValue(field: string, row: RowLike): string {
  if (isWaLiteralVar(field)) return waLiteralText(field).trim();
  switch (field) {
    case "nombre":
      return text(row.nombre);
    case "telefono":
      return text(row.telefono);
    case "dias":
    case "dias_atraso":
      return text(row.dias) || text(row.dias_atraso);
    default:
      return text(row[field]);
  }
}

export type WaVariableProblem = {
  /** Posición {{N}} en el template. */
  n: number;
  field: string;
  kind: "sin_asignar" | "dato_vacio";
  /** Cantidad de destinatarios afectados (solo dato_vacio). */
  affected: number;
  /** Nombres de ejemplo (hasta 3). */
  sample: string[];
};

export type WaVariablesCheck = {
  ok: boolean;
  problems: WaVariableProblem[];
  /** Texto listo para mostrar. */
  message: string;
};

/** Mensaje para quien arma la campaña. */
export function describeWaVariableProblems(problems: WaVariableProblem[]): string {
  if (!problems.length) return "";
  return problems
    .map((p) => {
      if (p.kind === "sin_asignar") {
        return `La variable {{${p.n}}} no tiene un dato asignado. Elegí qué columna va ahí o poné un texto fijo.`;
      }
      const who = p.sample.length ? ` (por ejemplo: ${p.sample.join(", ")})` : "";
      return `A ${p.affected.toLocaleString("es-AR")} destinatario${p.affected === 1 ? "" : "s"} le falta «${p.field}» para la variable {{${p.n}}}${who}. Completá esa columna en el CSV.`;
    })
    .join(" ");
}

/**
 * Revisa que cada {{N}} del template de WhatsApp tenga de dónde sacar su valor.
 * Meta rechaza (131008) cualquier variable vacía, así que es mejor frenar antes de enviar.
 * `rows` es opcional: sin filas solo se revisan las variables sin asignar.
 */
export function checkWaVariables(opts: {
  variables: string[] | undefined | null;
  /** Con botón de URL la variable del link no va en el BODY. */
  urlButton?: boolean;
  rows?: object[];
  /** Solo filas con teléfono reciben WhatsApp en campañas mixtas. */
  onlyWithPhone?: boolean;
}): WaVariablesCheck {
  const vars = (opts.variables || []).map((v) => String(v ?? ""));
  const rows = (opts.rows || []) as RowLike[];
  const problems: WaVariableProblem[] = [];

  vars.forEach((field, idx) => {
    const n = idx + 1;
    const f = field.trim();
    if (opts.urlButton && (f === "url_lectura" || f === "boton_url")) return;
    if (isWaTemplateVarEmpty(f) || isWaPlaceholderField(f)) {
      problems.push({ n, field: f, kind: "sin_asignar", affected: 0, sample: [] });
      return;
    }
    if (AUTO_FIELDS.has(f) || isWaLiteralVar(f)) return;
    const target = opts.onlyWithPhone ? rows.filter((r) => text(r.telefono)) : rows;
    const bad = target.filter((r) => !resolveWaFieldValue(f, r));
    if (bad.length) {
      problems.push({
        n,
        field: f,
        kind: "dato_vacio",
        affected: bad.length,
        sample: bad.slice(0, 3).map((r) => text(r.nombre) || text(r.email) || text(r.dni) || "sin nombre"),
      });
    }
  });

  return { ok: problems.length === 0, problems, message: describeWaVariableProblems(problems) };
}
