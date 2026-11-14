"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookmarkPlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { SavedWaTemplate } from "@/lib/types";
import { lastUsedWaTemplateKey, pickPreferredOrgWaTemplate } from "@/lib/wa-saved-template";
import {
  createSavedWaTemplate,
  deleteSavedWaTemplate,
  listSavedWaTemplates,
  updateSavedWaTemplate,
  type WaTemplatesAuthMode,
} from "@/lib/wa-templates-client";
import type { WaTemplateFieldsValue } from "@/components/empresa/wa-template-fields";
import { usesNotificasDefaultTemplate } from "@/lib/wa-template-fields";

const NONE = "__none__";

export function WaSavedTemplates({
  orgId,
  mode,
  current,
  onApply,
  disabled,
  autoApply = false,
  reloadKey = 0,
  hideSelector = false,
}: {
  orgId: string;
  mode: WaTemplatesAuthMode;
  current: WaTemplateFieldsValue;
  onApply: (next: WaTemplateFieldsValue) => void;
  disabled?: boolean;
  autoApply?: boolean;
  reloadKey?: number;
  /**
   * Cuando arriba ya hay un selector de plantilla (OrgWaTemplatePicker), este bloque no repite la lista:
   * solo guarda, actualiza o quita el mapeo de la plantilla que está elegida.
   */
  hideSelector?: boolean;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<SavedWaTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const list = await listSavedWaTemplates(mode, orgId);
      setItems(list);
      return list;
    } catch (e) {
      toast({
        title: "No se pudieron cargar los templates guardados",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
      return [] as SavedWaTemplate[];
    } finally {
      setLoading(false);
    }
  }, [mode, orgId, toast]);

  const matchedId = useMemo(() => {
    const name = current.name.trim().toLowerCase();
    if (!name) return "";
    const same = items.filter((t) => t.templateName.toLowerCase() === name);
    return same.find((t) => t.id === selectedId)?.id || same[0]?.id || "";
  }, [items, current.name, selectedId]);

  // Con el selector oculto, lo elegido arriba manda: seguimos esa plantilla y su nombre guardado.
  useEffect(() => {
    if (!hideSelector) return;
    setSelectedId(matchedId);
    const item = items.find((t) => t.id === matchedId);
    setLabel(item ? item.label : "");
  }, [hideSelector, matchedId, items]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    void (async () => {
      const list = (await refresh()) || [];
      if (cancelled) return;
      if (hideSelector || !autoApply || usesNotificasDefaultTemplate(current.name) === false) return;
      const lastId = typeof window !== "undefined" ? window.localStorage.getItem(lastUsedWaTemplateKey(orgId)) : null;
      const last = lastId ? list.find((t) => t.id === lastId) : undefined;
      const chosen =
        last && !usesNotificasDefaultTemplate(last.templateName)
          ? last
          : pickPreferredOrgWaTemplate(list);
      if (!chosen) return;
      setSelectedId(chosen.id);
      setLabel(chosen.label);
      onApply({
        name: chosen.templateName,
        lang: chosen.templateLang,
        variables: chosen.templateVariables,
        urlButton: chosen.urlButton,
        templateBody: chosen.templateBody,
      });
    })();
    return () => {
      cancelled = true;
    };
    // Solo al montar / cambiar org: no reaplicar si el usuario edita a mano.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, mode, autoApply]);

  useEffect(() => {
    if (!orgId || !reloadKey) return;
    void refresh();
  }, [orgId, reloadKey, refresh]);

  function applyItem(tpl: SavedWaTemplate) {
    setSelectedId(tpl.id);
    setLabel(tpl.label);
    onApply({
      name: tpl.templateName,
      lang: tpl.templateLang,
      variables: tpl.templateVariables,
      urlButton: tpl.urlButton,
      templateBody: tpl.templateBody,
    });
    try {
      window.localStorage.setItem(lastUsedWaTemplateKey(orgId), tpl.id);
    } catch {
      /* ignore */
    }
  }

  async function saveCurrent() {
    const name = current.name.trim();
    const saveLabel = (label.trim() || name).slice(0, 80);
    if (saveLabel.length < 2) {
      toast({ title: "Poné un nombre para reconocer este template", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        label: saveLabel,
        templateName: name,
        templateLang: current.lang,
        templateVariables: current.variables,
        urlButton: current.urlButton,
        templateBody: current.templateBody?.trim() || undefined,
      };
      if (selectedId) {
        await updateSavedWaTemplate(mode, selectedId, payload);
        toast({ title: "Template actualizado", description: saveLabel });
      } else {
        const id = await createSavedWaTemplate(mode, { orgId, ...payload });
        setSelectedId(id);
        try {
          window.localStorage.setItem(lastUsedWaTemplateKey(orgId), id);
        } catch {
          /* ignore */
        }
        toast({ title: "Template guardado", description: "La próxima campaña lo podés cargar desde el listado." });
      }
      await refresh();
    } catch (e) {
      toast({
        title: "No se pudo guardar",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await deleteSavedWaTemplate(mode, selectedId);
      if (typeof window !== "undefined" && window.localStorage.getItem(lastUsedWaTemplateKey(orgId)) === selectedId) {
        window.localStorage.removeItem(lastUsedWaTemplateKey(orgId));
      }
      setSelectedId("");
      toast({ title: "Template quitado del listado" });
      await refresh();
    } catch (e) {
      toast({
        title: "No se pudo borrar",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!orgId) return null;

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">
          {hideSelector ? "Mapeo de esta plantilla" : "Templates guardados de la organización"}
        </p>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {!hideSelector && (
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1">
          <Label className="text-xs">Cargar mapeo</Label>
          <Select
            value={selectedId || NONE}
            disabled={disabled || busy}
            onValueChange={(v) => {
              if (v === NONE) {
                setSelectedId("");
                return;
              }
              const tpl = items.find((t) => t.id === v);
              if (tpl) applyItem(tpl);
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={items.length ? "Elegí un template" : "Todavía no hay ninguno"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— Armar uno nuevo —</SelectItem>
              {items.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label} ({t.templateName})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive h-9"
            disabled={disabled || busy}
            onClick={() => void removeSelected()}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Quitar
          </Button>
        ) : null}
      </div>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1">
          <Label className="text-xs">Nombre para reconocer</Label>
          <Input
            className="h-9"
            placeholder="Ej. Deuda 180 días GOcuotas"
            value={label}
            disabled={disabled || busy}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <Button type="button" variant="secondary" className="h-9" disabled={disabled || busy} onClick={() => void saveCurrent()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <BookmarkPlus className="h-4 w-4 mr-1" />}
          {selectedId ? "Actualizar" : "Guardar mapeo"}
        </Button>
        {hideSelector && selectedId ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive h-9"
            disabled={disabled || busy}
            onClick={() => void removeSelected()}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Quitar
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Guarda el nombre de Meta, el idioma y qué campo va en cada {"{{N}}"}. No cambia el template en Business Manager.
      </p>
    </>
  );

  if (hideSelector) {
    return (
      <details className="group rounded-md border bg-muted/30 p-3">
        <summary className="cursor-pointer select-none text-xs font-medium">
          {selectedId ? "Actualizar el mapeo guardado de esta plantilla" : "Guardar este mapeo para la próxima campaña"}
          <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>
        </summary>
        <div className="space-y-3 pt-3">{content}</div>
      </details>
    );
  }

  return <div className="rounded-md border bg-muted/30 p-3 space-y-3">{content}</div>;
}
