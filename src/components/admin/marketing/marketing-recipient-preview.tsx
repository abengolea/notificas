"use client";

import { useMemo, useState } from "react";
import { StageBadge } from "./stage-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { countryName } from "@/lib/marketing/countries";
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

export type PreviewContact = {
  id: string;
  email: string;
  name: string;
  company: string;
  title: string;
  country: string;
  stage: string;
  eligible: boolean;
  skipReason: string | null;
};

type EligibilityFilter = "all" | "eligible" | "skipped";

function contactHaystack(c: PreviewContact): string {
  return [c.name, c.email, c.company, c.title, countryName(c.country) || c.country]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function MarketingRecipientPreview({
  contacts,
  total,
  eligible,
  skipped,
  emptyHint,
  onViewMessage,
}: {
  contacts: PreviewContact[];
  total: number;
  eligible: number;
  skipped: number;
  emptyHint?: string;
  onViewMessage?: (contactId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [eligibility, setEligibility] = useState<EligibilityFilter>("eligible");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (eligibility === "eligible" && !c.eligible) return false;
      if (eligibility === "skipped" && c.eligible) return false;
      if (!q) return true;
      return contactHaystack(c).includes(q);
    });
  }, [contacts, eligibility, query]);

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyHint || "Esta lista no tiene contactos todavía."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {eligible} {eligible === 1 ? "envío" : "envíos"}
          {skipped ? ` · ${skipped} afuera` : ""}
          {contacts.length < total ? ` · lista ${contacts.length}/${total}` : ""}
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          aria-label="Buscar destinatario"
          placeholder="Buscar nombre, empresa o email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 text-sm sm:max-w-xs"
        />
        <Select value={eligibility} onValueChange={(v) => setEligibility(v as EligibilityFilter)}>
          <SelectTrigger className="h-8 w-full text-sm sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="eligible">Solo van a recibir</SelectItem>
            <SelectItem value="all">Todos en la lista</SelectItem>
            <SelectItem value="skipped">Excluidos del envío</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground sm:ml-auto">
          {filtered.length} {filtered.length === 1 ? "fila" : "filas"}
        </span>
      </div>
      <div className="max-h-52 overflow-auto rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 py-1 text-xs">Destinatario</TableHead>
              <TableHead className="h-8 py-1 text-xs w-[88px]">País</TableHead>
              <TableHead className="h-8 py-1 text-xs w-[88px]">Estado</TableHead>
              {onViewMessage ? <TableHead className="h-8 py-1 text-xs w-[100px] text-right">Preview</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={onViewMessage ? 4 : 3} className="py-6 text-center text-xs text-muted-foreground">
                  Ningún contacto coincide con el filtro.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className={c.eligible ? undefined : "opacity-55"}>
                  <TableCell className="py-1.5 align-top">
                    <div className="text-xs font-medium leading-snug">{c.company || c.email}</div>
                    <div className="text-[11px] leading-snug text-muted-foreground">
                      {c.name ? `${c.name} · ${c.email}` : c.email}
                    </div>
                  </TableCell>
                  <TableCell className="py-1.5 text-xs">{countryName(c.country) || c.country || "—"}</TableCell>
                  <TableCell className="py-1.5">
                    {c.eligible ? (
                      <StageBadge stage={c.stage} />
                    ) : (
                      <span className="text-[11px] text-muted-foreground">{c.skipReason || "No"}</span>
                    )}
                  </TableCell>
                  {onViewMessage ? (
                    <TableCell className="py-1.5 text-right">
                      {c.eligible ? (
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onViewMessage(c.id)}>
                          Ver
                        </Button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
