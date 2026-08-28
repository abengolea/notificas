"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WA_DEFAULT_TEMPLATE_HINT,
  WA_DEFAULT_TEMPLATE_NAME,
  WA_TEMPLATE_DEFAULT_VARS,
  WA_TEMPLATE_HINT,
  WA_TEMPLATE_LANGS,
  WA_TEMPLATE_MAX_VARS,
  WA_TEMPLATE_VARIABLE_OPTIONS,
  encodeWaLiteral,
  isWaLiteralVar,
  usesNotificasDefaultTemplate,
  waLiteralText,
} from "@/lib/wa-template-fields";
import { fetchMetaApprovedTemplateBody, type WaTemplatesAuthMode } from "@/lib/wa-templates-client";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const KNOWN_FIELDS: Set<string> = new Set(WA_TEMPLATE_VARIABLE_OPTIONS.map((o) => o.value));
const CUSTOM_FIELD = "__custom__";
const LITERAL_FIELD = "__literal__";

function rowMode(v: string): "known" | "literal" | "custom" {
  if (KNOWN_FIELDS.has(v)) return "known";
  if (isWaLiteralVar(v)) return "literal";
  return "custom";
}

export type WaTemplateFieldsValue = {
  name: string;
  lang: string;
  variables: string[];
  urlButton: boolean;
  templateBody?: string;
};

export function WaTemplateFields({
  value,
  onChange,
  disabled,
  idPrefix = "wa",
  namePlaceholder = "Vacío = notificaciones_notificas",
  orgId,
  authMode,
}: {
  value: WaTemplateFieldsValue;
  onChange: (next: WaTemplateFieldsValue) => void;
  disabled?: boolean;
  idPrefix?: string;
  namePlaceholder?: string;
  orgId?: string;
  authMode?: WaTemplatesAuthMode;
}) {
  const set = (patch: Partial<WaTemplateFieldsValue>) => onChange({ ...value, ...patch });
  const usingDefault = usesNotificasDefaultTemplate(value.name);
  const [fetchingBody, setFetchingBody] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function pullFromMeta() {
    if (!orgId || !authMode || !value.name.trim()) return;
    setFetchingBody(true);
    setFetchError(null);
    try {
      const fetched = await fetchMetaApprovedTemplateBody(authMode, {
        orgId,
        name: value.name.trim(),
        lang: value.lang,
      });
      set({ templateBody: fetched.body });
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "No se pudo traer el template");
    } finally {
      setFetchingBody(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nombre del template (aprobado en Meta)</Label>
          <Input
            placeholder={namePlaceholder}
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Idioma</Label>
          <Select value={value.lang} onValueChange={(lang) => set({ lang })} disabled={disabled}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WA_TEMPLATE_LANGS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {usingDefault ? (
        <div className="rounded-md border bg-muted/40 p-3 space-y-1">
          <p className="text-xs font-medium">
            Template por defecto: <span className="font-mono">{WA_DEFAULT_TEMPLATE_NAME}</span>
          </p>
          <p className="text-xs text-muted-foreground">{WA_DEFAULT_TEMPLATE_HINT}</p>
          <p className="text-xs font-mono text-muted-foreground">
            {WA_TEMPLATE_DEFAULT_VARS.map((v, i) => `{{${i + 1}}}→${v}`).join(" · ")}
          </p>
        </div>
      ) : (
      <div className="space-y-2">
        <Label className="text-xs">
          Variables del template — ¿qué campo va en cada <code>{"{{N}}"}</code>?
        </Label>
        <div className="space-y-2">
          {value.variables.map((v, i) => {
            const mode = rowMode(v);
            return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-10 shrink-0 font-mono">{`{{${i + 1}}}`}</span>
              <Select
                value={mode === "known" ? v : mode === "literal" ? LITERAL_FIELD : CUSTOM_FIELD}
                onValueChange={(val) =>
                  set({
                    variables: value.variables.map((x, j) =>
                      j === i
                        ? val === CUSTOM_FIELD
                          ? ""
                          : val === LITERAL_FIELD
                            ? encodeWaLiteral("")
                            : val
                        : x
                    ),
                  })
                }
                disabled={disabled}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WA_TEMPLATE_VARIABLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_FIELD}>otro campo (columna CSV)</SelectItem>
                  <SelectItem value={LITERAL_FIELD}>texto fijo (igual para todos)</SelectItem>
                </SelectContent>
              </Select>
              {mode === "custom" && (
                <Input
                  className="h-8"
                  placeholder="columna del CSV, ej. fecha"
                  value={v}
                  onChange={(e) =>
                    set({
                      variables: value.variables.map((x, j) => (j === i ? e.target.value : x)),
                    })
                  }
                  disabled={disabled}
                />
              )}
              {mode === "literal" && (
                <Input
                  className="h-8"
                  placeholder="ej. 14/02/26"
                  value={waLiteralText(v)}
                  onChange={(e) =>
                    set({
                      variables: value.variables.map((x, j) =>
                        j === i ? encodeWaLiteral(e.target.value) : x
                      ),
                    })
                  }
                  disabled={disabled}
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive h-8 px-2"
                onClick={() => set({ variables: value.variables.filter((_, j) => j !== i) })}
                disabled={disabled}
              >
                ✕
              </Button>
            </div>
            );
          })}
          {value.variables.length < WA_TEMPLATE_MAX_VARS && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => set({ variables: [...value.variables, "nombre"] })}
            >
              + Agregar {`{{${value.variables.length + 1}}}`}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{WA_TEMPLATE_HINT}</p>
        <div className="flex items-start gap-3 rounded-md border p-3">
          <Checkbox
            id={`${idPrefix}-url-button`}
            checked={value.urlButton}
            onCheckedChange={(v) => set({ urlButton: v === true })}
            className="mt-0.5"
            disabled={disabled}
          />
          <div className="space-y-1">
            <label htmlFor={`${idPrefix}-url-button`} className="text-xs font-medium leading-none">
              El template tiene un botón de enlace
            </label>
            <p className="text-xs text-muted-foreground">
              Activalo solo si en Meta agregaste un botón URL. Notificas manda ahí el link del lector.
              En Meta el botón debe ser: dominio de Notificas + variable, por ejemplo{" "}
              <code>https://notificas.com.ar/{"{{1}}"}</code>.
            </p>
          </div>
        </div>
        {value.name.trim() && (
          <div className="rounded-md bg-muted/50 p-2 text-xs font-mono text-muted-foreground">
            Preview de llamada a Meta: template=<strong>{value.name}</strong>, variables=[
            {value.variables.map((v, i) => `{{${i + 1}}}→${isWaLiteralVar(v) ? `texto «${waLiteralText(v)}»` : v}`).join(", ")}]
            {value.urlButton ? ", botón URL=sí" : ""}
          </div>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Texto del BODY aprobado en Meta</Label>
            {orgId && authMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={disabled || fetchingBody || !value.name.trim()}
                onClick={() => void pullFromMeta()}
              >
                {fetchingBody ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Traer de Meta
              </Button>
            )}
          </div>
          <Textarea
            value={value.templateBody || ""}
            onChange={(e) => set({ templateBody: e.target.value })}
            rows={6}
            disabled={disabled}
            placeholder="Hola {{1}}, DNI {{2}}. Registramos una deuda…"
            className="text-sm"
          />
          {fetchError ? <p className="text-xs text-destructive">{fetchError}</p> : null}
          <p className="text-xs text-muted-foreground">
            Copiá el texto tal como está aprobado en Meta, con {`{{1}}`}, {`{{2}}`}… En campañas mixtas el correo
            muestra este mismo mensaje (no un aviso para hacer clic).
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
