"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { ArtStatusBadge } from "@/components/art/art-status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/firebase";
import { artPersonRelationLabel, type ArtPersonRelation } from "@/lib/art/types";
import type { CanalCampaign, RecipientEntry } from "@/lib/types";
import { phoneDigits } from "@/lib/parse-campaign-csv";

type PadronRow = {
  id: string;
  fullName: string;
  cuil: string;
  phone: string;
  email: string;
  dni: string;
  status: string;
  relation?: ArtPersonRelation;
};

export type { PadronRow };

async function authFetch(url: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sin sesión");
  const token = await user.getIdToken();
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

function canSendOnCanal(row: PadronRow, canal: CanalCampaign): boolean {
  if (canal === "email") return Boolean(row.email.trim());
  if (canal === "whatsapp") return Boolean(phoneDigits(row.phone));
  return Boolean(row.email.trim() || phoneDigits(row.phone));
}

export function padronRowToRecipient(row: PadronRow): RecipientEntry {
  const entry: RecipientEntry = {
    nombre: row.fullName,
    email: row.email.trim().toLowerCase(),
    artRecipientId: row.id,
  };
  if (row.phone) entry.telefono = row.phone;
  if (row.dni) entry.dni = row.dni;
  return entry;
}

export function CampaignPadronPicker({
  orgId,
  canal,
  selectedIds,
  onChange,
}: {
  orgId: string;
  canal: CanalCampaign;
  selectedIds: Set<string>;
  onChange: (next: PadronRow[], selected: Set<string>) => void;
}) {
  const [rows, setRows] = useState<PadronRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/empresa/art/recipients?orgId=${encodeURIComponent(orgId)}&status=active&limit=100`);
      const json = (await res.json()) as { recipients?: PadronRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || "No se pudo cargar el padrón");
      setRows(Array.isArray(json.recipients) ? json.recipients : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el padrón");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) void load();
      else {
        setRows([]);
        setLoading(false);
      }
    });
    return () => unsub();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!canSendOnCanal(r, canal)) return false;
      if (!q) return true;
      return (
        r.fullName.toLowerCase().includes(q) ||
        r.cuil.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        r.email.toLowerCase().includes(q) ||
        r.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
      );
    });
  }, [rows, query, canal]);

  function toggle(id: string, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onChange(rows, next);
  }

  function toggleVisible(checked: boolean) {
    const next = new Set(selectedIds);
    for (const r of visible) {
      if (checked) next.add(r.id);
      else next.delete(r.id);
    }
    onChange(rows, next);
  }

  const visibleSelected = visible.filter((r) => selectedIds.has(r.id)).length;

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-5 text-muted-foreground">
        Solo personas con adhesión activa. Si todavía no están adheridas, cargalas en{" "}
        <Link href={`/empresa/${orgId}/adhesiones-electronicas`} className="text-foreground underline-offset-2 hover:underline">
          Adhesiones
        </Link>
        .
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, CUIL o email"
          className="h-8 bg-background pl-8 text-[13px]"
          aria-label="Buscar personas adheridas"
        />
      </div>
      {loading ? (
        <p className="text-[13px] text-muted-foreground">Cargando padrón…</p>
      ) : error ? (
        <p className="text-[13px] text-destructive">{error}</p>
      ) : visible.length === 0 ? (
        <p className="rounded-md border border-border/80 bg-muted/30 px-3 py-6 text-center text-[13px] leading-5 text-muted-foreground">
          {rows.length === 0
            ? "No hay personas con adhesión activa."
            : canal === "email"
              ? "Nadie del padrón tiene email, o no coinciden con la búsqueda."
              : "Nadie del padrón tiene teléfono, o no coinciden con la búsqueda."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border/80">
          <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
            <Checkbox
              checked={visible.length > 0 && visibleSelected === visible.length}
              onCheckedChange={(v) => toggleVisible(v === true)}
              aria-label="Seleccionar visibles"
            />
            <span className="text-[13px] text-muted-foreground">
              {visibleSelected} de {visible.length} visibles
            </span>
            {selectedIds.size > 0 ? (
              <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 px-2 text-[13px]" onClick={() => onChange(rows, new Set())}>
                Quitar todas
              </Button>
            ) : null}
          </div>
          <ul className="max-h-72 overflow-auto">
            {visible.map((r) => (
              <li key={r.id} className="flex items-center gap-3 border-b border-border/60 px-3 py-2 last:border-0">
                <Checkbox
                  checked={selectedIds.has(r.id)}
                  onCheckedChange={(v) => toggle(r.id, v === true)}
                  aria-label={`Seleccionar ${r.fullName}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium leading-5">{r.fullName}</p>
                  <p className="truncate text-[12px] leading-4 text-muted-foreground">
                    {artPersonRelationLabel(r.relation)}
                    <span className="px-1 text-border">·</span>
                    {r.email || r.phone}
                  </p>
                </div>
                <ArtStatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
