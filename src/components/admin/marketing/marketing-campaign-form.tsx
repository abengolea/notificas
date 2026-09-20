"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { MarketingSubnav } from "./marketing-subnav";
import { MarketingListUpload } from "./marketing-list-upload";
import { MarketingRecipientPreview, type PreviewContact } from "./marketing-recipient-preview";
import { MarketingTaxonomyFields, type TaxonomyCatalog } from "./marketing-taxonomy-fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarketingEmailEditor } from "./marketing-email-editor";
import { useToast } from "@/hooks/use-toast";
import { blankCampaignEmailContent, paragraphsToText, type CampaignEmailContent } from "@/lib/marketing/campaign-email";

const INCLUDE_STAGES = ["new", "sent", "opened", "clicked", "replied"];

type ListOption = {
  id: string;
  name: string;
  contactCount: number;
  virtual?: boolean;
};

type Audience = {
  total: number;
  eligible: number;
  skipped: number;
  companyCount?: number;
  contacts: PreviewContact[];
};

export function MarketingCampaignForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<"crm" | "list">("crm");
  const [listId, setListId] = useState("");
  const [lists, setLists] = useState<ListOption[] | null>(null);
  const [catalog, setCatalog] = useState<TaxonomyCatalog | null>(null);
  const [countryCode, setCountryCode] = useState("");
  const [industryId, setIndustryId] = useState("");
  const [useCaseIds, setUseCaseIds] = useState<string[]>([]);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [form, setForm] = useState({
    name: "",
    subject: "",
  });
  const [emailContent, setEmailContent] = useState<CampaignEmailContent>(blankCampaignEmailContent());

  const namedLists = useMemo(() => (lists || []).filter((l) => !l.virtual), [lists]);
  const canSubmit = source === "crm" ? Boolean(countryCode && industryId && useCaseIds.length) : Boolean(listId);

  async function refreshLists() {
    const res = await fetch("/api/admin/marketing/lists", { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudieron cargar las listas");
    setLists(data.lists || []);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [listsRes, catalogRes] = await Promise.all([
          fetch("/api/admin/marketing/lists", { credentials: "include" }),
          fetch("/api/admin/marketing/catalog", { credentials: "include" }),
        ]);
        const listsData = await listsRes.json();
        const catalogData = await catalogRes.json();
        if (!listsRes.ok) throw new Error(listsData.error || "No se pudieron cargar las listas");
        if (!catalogRes.ok) throw new Error(catalogData.error || "No se pudieron cargar los rubros");
        if (cancelled) return;
        setLists(listsData.lists || []);
        setCatalog({
          countries: catalogData.countries || [],
          industries: catalogData.industries || [],
          useCases: catalogData.useCases || [],
        });
      } catch (e) {
        if (!cancelled) {
          setLists([]);
          setCatalog({ countries: [], industries: [], useCases: [] });
          toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    const crmReady = source === "crm" && countryCode && industryId && useCaseIds.length;
    const listReady = source === "list" && listId;
    if (!crmReady && !listReady) {
      setAudience(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoadingAudience(true);
      void (async () => {
        try {
          const url =
            source === "crm"
              ? `/api/admin/marketing/crm-audience?countryCode=${encodeURIComponent(countryCode)}&industryId=${encodeURIComponent(industryId)}&useCaseIds=${encodeURIComponent(useCaseIds.join(","))}&stages=${INCLUDE_STAGES.join(",")}`
              : `/api/admin/marketing/recipients?listId=${encodeURIComponent(listId)}&stages=${INCLUDE_STAGES.join(",")}`;
          const res = await fetch(url, { credentials: "include", signal: controller.signal });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "No se pudo armar la lista");
          setAudience(data);
        } catch (e) {
          if (controller.signal.aborted) return;
          toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
        } finally {
          if (!controller.signal.aborted) setLoadingAudience(false);
        }
      })();
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [source, listId, countryCode, industryId, useCaseIds, toast]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (source === "crm" && (!countryCode || !industryId || useCaseIds.length === 0)) {
      toast({ title: "Elegí país, rubro y al menos un caso de uso", variant: "destructive" });
      return;
    }
    if (source === "list" && !listId) {
      toast({ title: "Cargá un CSV de destinatarios o elegí una lista", variant: "destructive" });
      return;
    }
    if (!emailContent.title.trim() || paragraphsToText(emailContent.paragraphs).trim().length < 8) {
      toast({ title: "Completá el título y los párrafos del correo", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/marketing/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          emailContent: { ...emailContent, campaignName: form.name },
          source,
          listId: source === "list" ? listId : undefined,
          countryCode: source === "crm" ? countryCode : undefined,
          industryId: source === "crm" ? industryId : undefined,
          useCaseId: source === "crm" ? useCaseIds[0] : undefined,
          useCaseIds: source === "crm" ? useCaseIds : undefined,
          includeStages: INCLUDE_STAGES,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "No se pudo crear");
      router.push(`/admin/marketing/campanas/${data.campaign.id}`);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
      setSaving(false);
    }
  }

  const emptyHint =
    source === "crm" && audience && (audience.companyCount || 0) === 0
      ? "No hay empresas de ese rubro y caso de uso en ese país. Clasificá las empresas para armar destinatarios."
      : source === "crm"
        ? "Esas empresas no tienen contactos enviables."
        : "Esa lista no tiene contactos enviables.";

  return (
    <div className="space-y-6">
      <MarketingSubnav />
      <form onSubmit={onSubmit} className="max-w-6xl space-y-5 rounded-lg border bg-background p-4">
        <div className="space-y-1">
          <Label htmlFor="camp-name">Nombre interno</Label>
          <Input id="camp-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Chile — intro marzo" />
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Destinatarios</p>
            <p className="text-sm text-muted-foreground">
              Elegí país, rubro y caso de uso. Si falta un rubro, cargalo en{" "}
              <Link href="/admin/marketing/catalogo" className="underline underline-offset-2">
                Catálogo
              </Link>
              . El CSV no inventa rubros.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={source === "crm" ? "default" : "outline"}
              onClick={() => setSource("crm")}
            >
              Empresas del CRM
            </Button>
            <Button
              type="button"
              variant={source === "list" ? "default" : "outline"}
              onClick={() => setSource("list")}
            >
              CSV / lista
            </Button>
          </div>

          {source === "crm" ? (
            <MarketingTaxonomyFields
              catalog={catalog}
              countryCode={countryCode}
              industryId={industryId}
              useCaseIds={useCaseIds}
              onCountryChange={setCountryCode}
              onIndustryChange={setIndustryId}
              onUseCaseIdsChange={setUseCaseIds}
            />
          ) : (
            <>
              <MarketingListUpload
                defaultName={form.name}
                catalog={catalog}
                requireTaxonomy
                onImported={(list) => {
                  setListId(list.listId);
                  void refreshLists().catch(() => undefined);
                }}
              />
              {namedLists.length ? (
                <div className="space-y-1">
                  <Label>O usar una lista ya cargada</Label>
                  <Select value={listId || undefined} onValueChange={setListId}>
                    <SelectTrigger><SelectValue placeholder="Ninguna todavía" /></SelectTrigger>
                    <SelectContent>
                      {namedLists.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name} ({l.contactCount})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </>
          )}

          {loadingAudience ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Leyendo destinatarios…
            </p>
          ) : audience ? (
            <>
              {source === "crm" && typeof audience.companyCount === "number" ? (
                <p className="text-sm text-muted-foreground">
                  {audience.companyCount} {audience.companyCount === 1 ? "empresa" : "empresas"} de ese rubro y caso de uso.
                </p>
              ) : null}
              <MarketingRecipientPreview
                contacts={audience.contacts}
                total={audience.total}
                eligible={audience.eligible}
                skipped={audience.skipped}
                emptyHint={emptyHint}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {source === "crm" ? "Elegí país, rubro y caso de uso para ver las empresas." : "Todavía no hay destinatarios en esta campaña."}
            </p>
          )}
        </div>

        <MarketingEmailEditor
          value={emailContent}
          onChange={setEmailContent}
          subject={form.subject}
          onSubjectChange={(subject) => setForm({ ...form, subject })}
          onTestResult={(ok, message) => toast({ title: message, variant: ok ? "default" : "destructive" })}
        />
        <Button type="submit" disabled={saving || !canSubmit}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar borrador"}
        </Button>
      </form>
    </div>
  );
}
