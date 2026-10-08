"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SavedWaTemplate } from "@/lib/types";
import { lastUsedWaTemplateKey, pickPreferredOrgWaTemplate } from "@/lib/wa-saved-template";
import { listSavedWaTemplates, type WaTemplatesAuthMode } from "@/lib/wa-templates-client";
import { WA_DEFAULT_TEMPLATE_NAME, usesNotificasDefaultTemplate } from "@/lib/wa-template-fields";

const DEFAULT_VALUE = "__default__";

export function OrgWaTemplatePicker({
  orgId,
  mode,
  selectedName,
  onSelect,
  autoSelect = true,
  includeDefault = true,
  disabled,
}: {
  orgId: string;
  mode: WaTemplatesAuthMode;
  selectedName?: string;
  onSelect: (tpl: SavedWaTemplate | null) => void;
  autoSelect?: boolean;
  includeDefault?: boolean;
  disabled?: boolean;
}) {
  const [items, setItems] = useState<SavedWaTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const initialNameRef = useRef(selectedName);

  const enabled = useMemo(
    () => items.filter((t) => !usesNotificasDefaultTemplate(t.templateName)),
    [items]
  );

  const selectedId = useMemo(() => {
    if (loading && usesNotificasDefaultTemplate(selectedName)) return "";
    if (usesNotificasDefaultTemplate(selectedName)) return DEFAULT_VALUE;
    const match = enabled.find(
      (t) => t.templateName.toLowerCase() === String(selectedName || "").trim().toLowerCase()
    );
    return match?.id || "";
  }, [enabled, loading, selectedName]);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const list = await listSavedWaTemplates(mode, orgId);
      setItems(list);
      return list;
    } catch {
      setItems([]);
      return [] as SavedWaTemplate[];
    } finally {
      setLoading(false);
    }
  }, [mode, orgId]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    void (async () => {
      const list = (await load()) || [];
      if (cancelled || !autoSelect) return;
      if (!usesNotificasDefaultTemplate(initialNameRef.current)) return;
      const real = list.filter((t) => !usesNotificasDefaultTemplate(t.templateName));
      if (!real.length) return;
      const lastId =
        typeof window !== "undefined" ? window.localStorage.getItem(lastUsedWaTemplateKey(orgId)) : null;
      const last = lastId ? real.find((t) => t.id === lastId) : undefined;
      const chosen = last || pickPreferredOrgWaTemplate(real);
      if (chosen) onSelectRef.current(chosen);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, mode, autoSelect, load]);

  if (!orgId || (!loading && enabled.length === 0)) return null;

  function choose(id: string) {
    if (id === DEFAULT_VALUE) {
      onSelect(null);
      return;
    }
    const tpl = enabled.find((t) => t.id === id);
    if (!tpl) return;
    try {
      window.localStorage.setItem(lastUsedWaTemplateKey(orgId), tpl.id);
    } catch {
      /* ignore */
    }
    onSelect(tpl);
  }

  const several = enabled.length > 1;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>Plantilla de WhatsApp</Label>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
      </div>
      <Select value={selectedId || undefined} disabled={disabled || loading} onValueChange={choose}>
        <SelectTrigger>
          <SelectValue placeholder={several ? "Elegí la plantilla de este envío" : "Plantilla de la empresa"} />
        </SelectTrigger>
        <SelectContent>
          {includeDefault ? (
            <SelectItem value={DEFAULT_VALUE}>
              Sobre de Notificas ({WA_DEFAULT_TEMPLATE_NAME})
            </SelectItem>
          ) : null}
          {enabled.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {several
          ? "Esta empresa tiene varias plantillas habilitadas. Elegí cuál sale en este envío."
          : `Se usa la plantilla habilitada para esta empresa: ${enabled[0]?.label || "—"}.`}
      </p>
    </div>
  );
}
