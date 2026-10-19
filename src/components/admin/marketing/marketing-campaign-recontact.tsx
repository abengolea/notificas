"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type EngagementFilter = "all" | "not_opened" | "opened" | "clicked" | "unsubscribed" | "bounced" | "failed";

type RecipientRow = {
  contactId: string;
  name: string;
  email: string;
  company: string;
  title: string;
  countryCode: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
  bouncedAt: string | null;
  unsubscribedAt: string | null;
  eligibleForRecontact: boolean;
  exclusionReason: string | null;
  sent: boolean;
  opened: boolean;
  clicked: boolean;
  replied: boolean;
  bounced: boolean;
  unsubscribed: boolean;
  failed: boolean;
};

type RecipientStats = {
  sent: number;
  opened: number;
  clicked: number;
  notOpened: number;
  unsubscribed: number;
  bounced: number;
  failed: number;
  eligibleForRecontact: number;
  excluded: number;
};

type CreatedList = {
  listId: string;
  listName: string;
  added: number;
  excluded: number;
  totalCandidates: number;
};

const FILTERS: Array<{ id: EngagementFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "not_opened", label: "Sin apertura" },
  { id: "opened", label: "Abrieron" },
  { id: "clicked", label: "Click" },
  { id: "unsubscribed", label: "Baja" },
  { id: "bounced", label: "Rebote" },
  { id: "failed", label: "Fallido" },
];

const EXCLUSION_LABEL: Record<string, string> = {
  not_sent: "No enviado",
  opened: "Abrió",
  clicked: "Clic",
  replied: "Respondió",
  unsubscribed: "Baja",
  bounced: "Rebote",
  failed: "Fallido",
  do_not_contact: "No contactar",
  invalid_email: "Email inválido",
  contact_deleted: "Contacto no elegible",
  not_eligible: "No elegible",
  already_recontacted: "Ya en recontacto",
};

function flagLabel(row: RecipientRow): string {
  const bits = [];
  if (row.opened) bits.push("abierto");
  if (row.clicked) bits.push("clic");
  if (row.replied) bits.push("respondió");
  if (row.unsubscribed) bits.push("baja");
  if (row.bounced) bits.push("rebote");
  if (row.failed) bits.push("fallido");
  if (!bits.length && row.sent) return "enviado";
  return bits.join(" · ") || "—";
}

export function MarketingCampaignRecontact({ campaignId }: { campaignId: string }) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<EngagementFilter>("all");
  const [items, setItems] = useState<RecipientRow[]>([]);
  const [stats, setStats] = useState<RecipientStats | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [prevStack, setPrevStack] = useState<Array<string | undefined>>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKey, setConfirmKey] = useState("");
  const [created, setCreated] = useState<CreatedList | null>(null);

  const load = useCallback(
    async (nextFilter: EngagementFilter, nextPageCursor?: string) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          engagementStatus: nextFilter,
          limit: "25",
        });
        if (nextPageCursor) qs.set("cursor", nextPageCursor);
        const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}/recipients?${qs}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudieron cargar los destinatarios");
        setItems(data.items || []);
        setStats(data.stats || null);
        setNextCursor(data.nextCursor);
        setCursor(nextPageCursor);
      } catch (e) {
        toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [campaignId, toast],
  );

  useEffect(() => {
    setPrevStack([]);
    void load(filter);
  }, [filter, load]);

  function changeFilter(next: EngagementFilter) {
    setFilter(next);
    setCreated(null);
  }

  async function createList() {
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}/recontact-list`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filter: "not_opened",
          idempotencyKey: confirmKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear la lista");
      setCreated({
        listId: data.listId,
        listName: data.listName,
        added: data.added,
        excluded: data.excluded,
        totalCandidates: data.totalCandidates,
      });
      setConfirmOpen(false);
      toast({ title: `Lista creada: ${data.listName}` });
      await load(filter, cursor);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  const tiles = [
    { label: "Enviados", value: stats?.sent || 0, filter: "all" as EngagementFilter },
    { label: "Aperturas registradas", value: stats?.opened || 0, filter: "opened" as EngagementFilter },
    { label: "Clicks", value: stats?.clicked || 0, filter: "clicked" as EngagementFilter },
    { label: "Sin apertura registrada", value: stats?.notOpened || 0, filter: "not_opened" as EngagementFilter },
    { label: "Bajas", value: stats?.unsubscribed || 0, filter: "unsubscribed" as EngagementFilter },
    { label: "Rebotes", value: stats?.bounced || 0, filter: "bounced" as EngagementFilter },
    { label: "Fallidos", value: stats?.failed || 0, filter: "failed" as EngagementFilter },
  ];

  return (
    <div className="space-y-4 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium">Recontacto</h4>
          <p className="text-xs text-muted-foreground">
            Destinatarios individuales de esta campaña. Crear una lista no modifica la audiencia histórica ni envía correo.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!stats || stats.eligibleForRecontact <= 0 || creating}
          onClick={() => {
            setConfirmKey(
              typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `recontact:${campaignId}:not_opened:${Date.now()}`,
            );
            setConfirmOpen(true);
          }}
        >
          Crear lista de recontacto
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4 lg:grid-cols-7">
        {tiles.map((tile) => (
          <button
            key={tile.label}
            type="button"
            className={`bg-background px-3 py-2.5 text-left transition-colors ${
              filter === tile.filter ? "ring-1 ring-inset ring-foreground/20 bg-muted/40" : "hover:bg-muted/20"
            }`}
            onClick={() => changeFilter(tile.filter)}
          >
            <dt className="text-xs text-muted-foreground">{tile.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{tile.value.toLocaleString("es-AR")}</dd>
          </button>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((row) => (
          <Button
            key={row.id}
            type="button"
            size="sm"
            variant={filter === row.id ? "default" : "outline"}
            onClick={() => changeFilter(row.id)}
          >
            {row.label}
          </Button>
        ))}
      </div>

      {filter === "not_opened" ? (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Sin apertura registrada no implica necesariamente que el mensaje no haya sido leído. Algunos clientes de correo bloquean o alteran el tracking de apertura.
        </p>
      ) : null}

      {created ? (
        <div className="space-y-2 rounded-md border px-3 py-3 text-sm">
          <p>
            Lista creada: <span className="font-medium">{created.listName}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {created.added} incorporados · {created.excluded} excluidos de {created.totalCandidates} candidatos. No se creó ni envió una campaña.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/marketing/contactos?listId=${encodeURIComponent(created.listId)}`}>Revisar lista</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/admin/marketing/campanas/nueva?listId=${encodeURIComponent(created.listId)}`}>
                Crear campaña draft desde esta lista
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destinatario</TableHead>
              <TableHead>Engagement</TableHead>
              <TableHead>Recontacto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Leyendo destinatarios individuales…
                  </span>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-sm text-muted-foreground">
                  No hay destinatarios con ese filtro.
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.contactId}>
                  <TableCell>
                    <Link href={`/admin/marketing/contactos/${row.contactId}`} className="font-medium hover:underline">
                      {row.company || row.email}
                    </Link>
                    <div className="text-sm text-muted-foreground">
                      {row.name} · {row.email}
                      {row.title ? ` · ${row.title}` : ""}
                      {row.countryCode ? ` · ${row.countryCode}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{flagLabel(row)}</TableCell>
                  <TableCell className="text-sm">
                    {row.eligibleForRecontact ? (
                      "Elegible"
                    ) : (
                      <span className="text-muted-foreground">
                        {EXCLUSION_LABEL[row.exclusionReason || ""] || row.exclusionReason || "excluido"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading || prevStack.length === 0}
          onClick={() => {
            const prev = [...prevStack];
            const last = prev.pop();
            setPrevStack(prev);
            void load(filter, last);
          }}
        >
          Anterior
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading || !nextCursor}
          onClick={() => {
            setPrevStack((stack) => [...stack, cursor]);
            void load(filter, nextCursor);
          }}
        >
          Siguiente
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Crear lista de recontacto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se van a evaluar los destinatarios individuales sin apertura registrada. Esto crea únicamente una lista CRM nueva.
              No modifica la campaña original, no cambia su audiencia histórica y no envía correo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Candidatos</dt>
              <dd className="font-semibold tabular-nums">{stats?.notOpened || 0}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Excluidos</dt>
              <dd className="font-semibold tabular-nums">{stats?.excluded || 0}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Elegibles finales</dt>
              <dd className="font-semibold tabular-nums">{stats?.eligibleForRecontact || 0}</dd>
            </div>
          </dl>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={creating || !stats || stats.eligibleForRecontact <= 0}
              onClick={(e) => {
                e.preventDefault();
                void createList();
              }}
            >
              {creating ? "Creando…" : "Crear solamente la lista"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
