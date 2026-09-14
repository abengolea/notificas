"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { MarketingSubnav } from "./marketing-subnav";
import { StageBadge } from "./stage-badge";
import { MARKETING_COUNTRIES } from "@/lib/marketing/countries";
import { MARKETING_STAGES, STAGE_LABEL, type MarketingStage } from "@/lib/marketing/stages";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type Contact = {
  id: string;
  email: string;
  name: string;
  company: string;
  title: string;
  country: string;
  stage: MarketingStage;
  lastSentAt?: string | null;
  lastRepliedAt?: string | null;
};

const CSV_TEMPLATE = "email,nombre,empresa,cargo,pais,notas\ncontacto@empresa.cl,Ana Pérez,Empresa Sur,Gerente,CL,\n";

export function MarketingContacts() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [country, setCountry] = useState(params.get("country") || "all");
  const [stage, setStage] = useState(params.get("stage") || "all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    company: "",
    title: "",
    country: "AR",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (country !== "all") sp.set("country", country);
      if (stage !== "all") sp.set("stage", stage);
      const res = await fetch(`/api/admin/marketing/contacts?${sp}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setRows(data.contacts || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [country, stage, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function pushFilters(nextCountry: string, nextStage: string) {
    const sp = new URLSearchParams();
    if (nextCountry !== "all") sp.set("country", nextCountry);
    if (nextStage !== "all") sp.set("stage", nextStage);
    router.replace(`/admin/marketing/contactos${sp.toString() ? `?${sp}` : ""}`);
  }

  const filtered = q.trim()
    ? rows.filter((r) => `${r.email} ${r.name} ${r.company} ${r.title}`.toLowerCase().includes(q.trim().toLowerCase()))
    : rows;

  async function onImport(file: File) {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/marketing/contacts/import", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo importar");
      toast({
        title: `Importados ${data.created} nuevos, ${data.updated} actualizados`,
        description: data.errorCount ? `${data.errorCount} filas con error` : undefined,
      });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/marketing/contacts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "No se pudo guardar");
      setForm({ email: "", name: "", company: "", title: "", country: form.country, notes: "" });
      toast({ title: "Contacto guardado" });
      await load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <MarketingSubnav />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>País</Label>
            <Select
              value={country}
              onValueChange={(v) => {
                setCountry(v);
                pushFilters(v, stage);
              }}
            >
              <SelectTrigger><SelectValue placeholder="País" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {MARKETING_COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Etapa</Label>
            <Select
              value={stage}
              onValueChange={(v) => {
                setStage(v);
                pushFilters(country, v);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Etapa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {MARKETING_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="mkt-q">Buscar</Label>
            <Input id="mkt-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email, empresa, nombre" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`} download="contactos-marketing.csv">
              Plantilla CSV
            </a>
          </Button>
          <Button type="button" variant="secondary" className="relative" disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="ml-2">Importar CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Importar CSV"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onImport(file);
                e.target.value = "";
              }}
            />
          </Button>
        </div>
      </div>

      <form onSubmit={onCreate} className="grid gap-3 rounded-lg border bg-background p-4 md:grid-cols-6">
        <div className="md:col-span-2 space-y-1">
          <Label htmlFor="c-email">Email</Label>
          <Input id="c-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="c-name">Nombre</Label>
          <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="c-co">Empresa</Label>
          <Input id="c-co" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="c-title">Cargo</Label>
          <Input id="c-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>País</Label>
          <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MARKETING_COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-5 space-y-1">
          <Label htmlFor="c-notes">Notas</Label>
          <Textarea id="c-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agregar"}
          </Button>
        </div>
      </form>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {total === 0 ? "No hay contactos con ese filtro. Importá un CSV o agregá uno arriba." : "Nada coincide con la búsqueda."}
        </p>
      ) : (
        <div className="rounded-lg border bg-background overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Último envío</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/admin/marketing/contactos/${r.id}`} className="font-medium hover:underline">
                      {r.company || "—"}
                    </Link>
                    {r.title ? <div className="text-sm text-muted-foreground">{r.title}</div> : null}
                  </TableCell>
                  <TableCell>
                    <div>{r.name || "—"}</div>
                    <div className="text-sm text-muted-foreground">{r.email}</div>
                  </TableCell>
                  <TableCell>{MARKETING_COUNTRIES.find((c) => c.code === r.country)?.name || r.country}</TableCell>
                  <TableCell><StageBadge stage={r.stage} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {r.lastRepliedAt
                      ? `Resp. ${new Date(r.lastRepliedAt).toLocaleDateString("es-AR")}`
                      : r.lastSentAt
                        ? new Date(r.lastSentAt).toLocaleDateString("es-AR")
                        : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="px-4 py-2 text-sm text-muted-foreground">{filtered.length} de {total}</p>
        </div>
      )}
    </div>
  );
}
