"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  contextAroundNumericPlaceholder,
  normalizeLetterColumnName,
  numericLetterPlaceholders,
  replaceNumericLetterPlaceholders,
} from "@/lib/campaign-letter-fields";
import { guessFieldFromContext } from "@/lib/meta-message-templates";
import { WA_LITERAL_PREFIX, WA_TEMPLATE_VARIABLE_OPTIONS } from "@/lib/wa-template-fields";

/** En la carta no existen estas dos: el remitente y el link los completa el sistema en WhatsApp, no el texto. */
const LETTER_OPTIONS = WA_TEMPLATE_VARIABLE_OPTIONS.filter(
  (o) => o.value !== "remitente" && o.value !== "url_lectura"
);
const KNOWN = new Set<string>(LETTER_OPTIONS.map((o) => o.value));
const CUSTOM = "__custom__";
const LITERAL = "__literal__";

function modeOf(v: string): "known" | "literal" | "custom" {
  if (KNOWN.has(v)) return "known";
  if (v.startsWith(WA_LITERAL_PREFIX)) return "literal";
  return "custom";
}

function isReady(v: string | undefined): boolean {
  if (!v) return false;
  if (v.startsWith(WA_LITERAL_PREFIX)) return v.slice(WA_LITERAL_PREFIX.length).trim() !== "";
  return normalizeLetterColumnName(v) !== "";
}

/**
 * Variables de la carta (lo que se abre en el lector y, en algunos modos, el cuerpo del correo).
 * Son independientes de las variables de la plantilla de Meta: acá cada {{nombre_de_columna}} se completa con esa
 * columna del CSV. Si se pegó un texto con {{1}}, {{2}}… se elige qué dato va en cada uno y se reescribe la carta.
 */
export function LetterVariablesPanel({
  text,
  onChangeText,
  columns,
  disabled,
}: {
  text: string;
  onChangeText: (next: string) => void;
  /** Columnas del CSV que ya usa la carta (con nombre). */
  columns: string[];
  disabled?: boolean;
}) {
  const numbers = useMemo(() => numericLetterPlaceholders([text]), [text]);
  const [mapping, setMapping] = useState<Record<number, string>>({});

  // Sugerencia inicial a partir de las palabras que rodean a cada {{N}} (deuda de $ → monto, cuotas → cuotas…).
  useEffect(() => {
    setMapping((cur) => {
      let changed = false;
      const next = { ...cur };
      for (const n of numbers) {
        if (next[n] === undefined) {
          next[n] = guessFieldFromContext(text, n);
          changed = true;
        }
      }
      return changed ? next : cur;
    });
  }, [numbers, text]);

  const allReady = numbers.length > 0 && numbers.every((n) => isReady(mapping[n]));
  const set = (n: number, v: string) => setMapping((cur) => ({ ...cur, [n]: v }));

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Variables de la carta</p>
        <p className="text-xs text-muted-foreground">
          Son propias de la carta y no tienen que ver con las de la plantilla de Meta. Cada{" "}
          <code>{"{{columna}}"}</code> se completa con esa columna del CSV: {"{{nombre}}"}, {"{{monto}}"},{" "}
          {"{{cuotas}}"} o cualquiera que agregues, como {"{{plazo}}"}.
        </p>
      </div>

      {columns.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">El CSV tiene que traer:</span>
          {columns.map((c) => (
            <code key={c} className="rounded bg-background px-1.5 py-0.5 border">
              {c}
            </code>
          ))}
        </div>
      ) : numbers.length === 0 ? (
        <p className="text-xs text-muted-foreground">Esta carta no usa variables: sale igual para todos.</p>
      ) : null}

      {numbers.length > 0 ? (
        <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-xs font-medium">
            La carta tiene {numbers.map((n) => `{{${n}}}`).join(", ")}, que no se completan solos. Elegí qué dato va en
            cada uno:
          </p>
          <div className="space-y-2">
            {numbers.map((n) => {
              const v = mapping[n] ?? "";
              const mode = modeOf(v);
              return (
                <div key={n} className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{`{{${n}}}`}</span>
                    <Select
                      value={mode === "known" ? v : mode === "literal" ? LITERAL : CUSTOM}
                      onValueChange={(val) => set(n, val === CUSTOM ? "" : val === LITERAL ? WA_LITERAL_PREFIX : val)}
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-8 w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LETTER_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM}>otra columna del CSV</SelectItem>
                        <SelectItem value={LITERAL}>texto fijo (igual para todos)</SelectItem>
                      </SelectContent>
                    </Select>
                    {mode === "custom" && (
                      <Input
                        className="h-8 w-52"
                        placeholder="columna del CSV, ej. plazo"
                        value={v}
                        onChange={(e) => set(n, e.target.value)}
                        disabled={disabled}
                      />
                    )}
                    {mode === "literal" && (
                      <Input
                        className="h-8 w-52"
                        placeholder="ej. 5 días"
                        value={v.slice(WA_LITERAL_PREFIX.length)}
                        onChange={(e) => set(n, `${WA_LITERAL_PREFIX}${e.target.value}`)}
                        disabled={disabled}
                      />
                    )}
                  </div>
                  <Label className="block pl-12 text-[11px] font-normal text-muted-foreground">
                    {contextAroundNumericPlaceholder(text, n)}
                  </Label>
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled || !allReady}
            onClick={() => onChangeText(replaceNumericLetterPlaceholders(text, mapping))}
          >
            Usar estos datos en la carta
          </Button>
          <p className="text-xs text-muted-foreground">
            Reescribe la carta: {"{{1}}"} pasa a {"{{nombre}}"}, etc. Después podés editarla como quieras.
          </p>
        </div>
      ) : null}
    </div>
  );
}
