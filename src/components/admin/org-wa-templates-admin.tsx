"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { WaSavedTemplates } from "@/components/empresa/wa-saved-templates";
import { WaTemplateFields, type WaTemplateFieldsValue } from "@/components/empresa/wa-template-fields";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  humanizeWaTemplateLabel,
  savedWaTemplateKey,
  variablesForApprovedTemplate,
} from "@/lib/meta-message-templates";
import type { SavedWaTemplate } from "@/lib/types";
import {
  WA_DEFAULT_TEMPLATE_NAME,
  WA_TEMPLATE_DEFAULT_VARS,
  usesNotificasDefaultTemplate,
} from "@/lib/wa-template-fields";
import {
  createSavedWaTemplate,
  deleteSavedWaTemplate,
  listMetaApprovedCatalog,
  listSavedWaTemplates,
  type MetaApprovedCatalogItem,
} from "@/lib/wa-templates-client";

const DEFAULT_EDITOR: WaTemplateFieldsValue = {
  name: WA_DEFAULT_TEMPLATE_NAME,
  lang: "es_AR",
  variables: [...WA_TEMPLATE_DEFAULT_VARS],
  urlButton: false,
};

function applyCatalogItem(item: MetaApprovedCatalogItem): WaTemplateFieldsValue {
  return {
    name: item.name,
    lang: item.language || "es_AR",
    variables: variablesForApprovedTemplate(item.name, item.body),
    urlButton: item.urlButton,
    templateBody: item.body || undefined,
  };
}

export function OrgWaTemplatesAdmin({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [current, setCurrent] = useState<WaTemplateFieldsValue>(DEFAULT_EDITOR);
  const [catalog, setCatalog] = useState<MetaApprovedCatalogItem[]>([]);
  const [saved, setSaved] = useState<SavedWaTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setCatalogError("");
    try {
      const [meta, rows] = await Promise.all([
        listMetaApprovedCatalog("admin", orgId),
        listSavedWaTemplates("admin", orgId),
      ]);
      setCatalog(meta);
      setSaved(rows);
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enabledByKey = useMemo(() => {
    const map = new Map<string, SavedWaTemplate[]>();
    for (const row of saved) {
      const key = savedWaTemplateKey(row.templateName, row.templateLang);
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }, [saved]);

  async function toggleTemplate(item: MetaApprovedCatalogItem, enable: boolean) {
    const key = savedWaTemplateKey(item.name, item.language);
    setBusyKey(key);
    try {
      if (enable) {
        const mapping = applyCatalogItem(item);
        await createSavedWaTemplate("admin", {
          orgId,
          label: humanizeWaTemplateLabel(item.name),
          templateName: mapping.name,
          templateLang: mapping.lang,
          templateVariables: mapping.variables,
          urlButton: mapping.urlButton,
          templateBody: mapping.templateBody,
        });
        setCurrent(mapping);
        toast({ title: "Plantilla habilitada", description: mapping.name });
      } else {
        const rows = enabledByKey.get(key) || [];
        for (const row of rows) {
          await deleteSavedWaTemplate("admin", row.id);
        }
        if (savedWaTemplateKey(current.name, current.lang) === key) {
          setCurrent(DEFAULT_EDITOR);
        }
        toast({ title: "Plantilla deshabilitada", description: item.name });
      }
      setReloadKey((n) => n + 1);
      await refresh();
    } catch (e) {
      toast({
        title: enable ? "No se pudo habilitar" : "No se pudo quitar",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusyKey("");
    }
  }

  return (
    <section className="space-y-4 rounded-lg border p-6">
      <div>
        <h4 className="font-semibold">Plantillas de WhatsApp (Meta)</h4>
        <p className="text-sm text-muted-foreground mt-1">
          Habilitá todas las que esta empresa pueda usar. Si no hay ninguna, WhatsApp sale con{" "}
          <span className="font-mono text-xs">{WA_DEFAULT_TEMPLATE_NAME}</span>. En el envío masivo eligen canal
          WhatsApp o Ambos y, en el paso Template, aparecen las habilitadas.
        </p>
      </div>

      <div className="rounded-md border bg-muted/30 p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium">Aprobadas en el WABA de Notificas</p>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        {catalogError ? (
          <p className="text-xs text-destructive">{catalogError}. Podés cargar un mapeo a mano abajo.</p>
        ) : null}
        <div className="space-y-1">
          <div className="flex items-start gap-3 rounded-md border px-3 py-2 bg-background/60">
            <Switch checked disabled aria-label="Plantilla por defecto siempre disponible" />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">Sobre de Notificas</p>
              <p className="text-xs text-muted-foreground font-mono break-all">{WA_DEFAULT_TEMPLATE_NAME}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Siempre disponible; no hace falta habilitarla.</p>
            </div>
          </div>
          {catalog
            .filter((item) => !usesNotificasDefaultTemplate(item.name))
            .map((item) => {
              const key = savedWaTemplateKey(item.name, item.language);
              const enabled = (enabledByKey.get(key) || []).length > 0;
              const busy = busyKey === key;
              return (
                <div
                  key={key}
                  className={`flex items-start gap-3 rounded-md border px-3 py-2 ${enabled ? "bg-primary/10 border-primary/40" : "bg-background/60"}`}
                >
                  <Switch
                    checked={enabled}
                    disabled={busy || loading}
                    onCheckedChange={(next) => void toggleTemplate(item, next)}
                    aria-label={`Habilitar ${item.name}`}
                  />
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => setCurrent(applyCatalogItem(item))}
                  >
                    <p className="text-sm font-medium leading-tight">{humanizeWaTemplateLabel(item.name)}</p>
                    <p className="text-xs text-muted-foreground font-mono break-all">
                      {item.name} · {item.language}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.variableCount} variable{item.variableCount === 1 ? "" : "s"}
                      {item.urlButton ? " · botón URL" : ""}
                    </p>
                  </button>
                </div>
              );
            })}
        </div>
        {!loading && !catalogError && catalog.filter((t) => !usesNotificasDefaultTemplate(t.name)).length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay otras plantillas aprobadas en Meta además de la de Notificas.</p>
        ) : null}
      </div>

      <WaSavedTemplates
        orgId={orgId}
        mode="admin"
        current={current}
        onApply={setCurrent}
        reloadKey={reloadKey}
      />
      <WaTemplateFields
        idPrefix="org-wa"
        orgId={orgId}
        authMode="admin"
        value={current}
        onChange={setCurrent}
        namePlaceholder="Nombre exacto en Meta"
      />
      <p className="text-xs text-muted-foreground">
        El interruptor habilita o quita la plantilla. Abajo podés ajustar el mapeo de cada {"{{N}}"} (nombre, tomo,
        monto, link del lector, etc.).
      </p>
    </section>
  );
}
