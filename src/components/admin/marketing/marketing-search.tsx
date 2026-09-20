"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Building2, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Result = {
  id: string;
  label: string;
  sub?: string;
  href: string;
  kind: "company" | "opportunity" | "contact";
};

const KIND_ICON: Record<Result["kind"], React.ElementType> = {
  company: Building2,
  opportunity: TrendingUp,
  contact: Users,
};

const KIND_LABEL: Record<Result["kind"], string> = {
  company: "Empresa",
  opportunity: "Oportunidad",
  contact: "Contacto",
};

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function MarketingSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const [companiesRes, oppsRes, contactsRes] = await Promise.all([
        fetch(`/api/admin/marketing/companies?q=${encodeURIComponent(trimmed)}&limit=4`),
        fetch(`/api/admin/marketing/opportunities?q=${encodeURIComponent(trimmed)}&limit=4`),
        fetch(`/api/admin/marketing/contacts?q=${encodeURIComponent(trimmed)}&limit=4`),
      ]);
      const companiesData = companiesRes.ok ? await companiesRes.json() : { companies: [] };
      const oppsData = oppsRes.ok ? await oppsRes.json() : { opportunities: [] };
      const contactsData = contactsRes.ok ? await contactsRes.json() : { contacts: [] };

      const all: Result[] = [
        ...(companiesData.companies || []).map((c: { id: string; name?: string; commercialStageId?: string }) => ({
          id: c.id,
          label: c.name || "Sin nombre",
          sub: c.commercialStageId,
          href: `/admin/marketing/empresas/${c.id}`,
          kind: "company" as const,
        })),
        ...(oppsData.opportunities || []).map((o: { id: string; name?: string; companyName?: string }) => ({
          id: o.id,
          label: o.name || "Sin nombre",
          sub: o.companyName,
          href: `/admin/marketing/oportunidades/${o.id}`,
          kind: "opportunity" as const,
        })),
        ...(contactsData.contacts || []).map((c: { id: string; name?: string; email?: string; company?: string }) => ({
          id: c.id,
          label: c.name || c.email || c.id,
          sub: c.company,
          href: `/admin/marketing/contactos/${c.id}`,
          kind: "contact" as const,
        })),
      ];
      setResults(all);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceTimer = setTimeout(() => search(query), 200);
    return () => { if (debounceTimer) clearTimeout(debounceTimer); };
  }, [query, search]);

  // close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // global / shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const showDropdown = open && (results.length > 0 || loading || query.trim().length >= 2);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 rounded-md border border-input bg-muted/40 px-2.5 h-8 w-[180px] focus-within:w-[260px] transition-all focus-within:bg-background focus-within:border-ring">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar... /"
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
        {loading && (
          <span className="h-3 w-3 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border bg-background shadow-lg">
          {results.length === 0 && !loading ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">
              {query.trim().length >= 2 ? "Sin resultados" : "Escribe para buscar..."}
            </p>
          ) : (
            <ul className="py-1">
              {results.map((r) => {
                const Icon = KIND_ICON[r.kind];
                return (
                  <li key={`${r.kind}-${r.id}`}>
                    <Link
                      href={r.href}
                      onClick={() => { setOpen(false); setQuery(""); }}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/60 transition-colors"
                    >
                      <span className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs",
                        r.kind === "company" ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300" :
                        r.kind === "opportunity" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300" :
                        "bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-300"
                      )}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.label}</p>
                        {r.sub && <p className="text-xs text-muted-foreground truncate">{r.sub}</p>}
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{KIND_LABEL[r.kind]}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
