"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, RefreshCw, RotateCcw, Search } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";
import {
  ADMIN_INVOICE_STATUSES,
  adminInvoiceStatusLabel,
  type AdminInvoiceCounts,
  type AdminInvoiceRow,
  type AdminInvoiceStatus,
} from "@/lib/admin-invoice-status";

type StatusFilter = "all" | AdminInvoiceStatus;

function formatMoney(value: number) {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
}

function voucherLabel(row: AdminInvoiceRow) {
  if (row.ptoVta == null && row.voucherNumber == null) return null;
  const pv = String(row.ptoVta ?? 0).padStart(5, "0");
  const nro = String(row.voucherNumber ?? 0).padStart(8, "0");
  const tipo = row.tipoComprobante ? `${row.tipoComprobante} ` : "";
  return `${tipo}${pv}-${nro}`;
}

function statusBadge(status: AdminInvoiceStatus) {
  const label = adminInvoiceStatusLabel(status);
  if (status === "issued") return <Badge className="bg-emerald-600 hover:bg-emerald-600">{label}</Badge>;
  if (status === "pending") return <Badge className="bg-amber-600 hover:bg-amber-600">{label}</Badge>;
  if (status === "failed") return <Badge variant="destructive">{label}</Badge>;
  return <Badge variant="secondary">{label}</Badge>;
}

export default function AdminInvoices() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<AdminInvoiceRow[]>([]);
  const [counts, setCounts] = useState<AdminInvoiceCounts>({
    issued: 0,
    pending: 0,
    failed: 0,
    none: 0,
    total: 0,
  });
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (search.trim()) params.set("q", search.trim());
      const qs = params.toString();
      const res = await fetch(`/api/admin/invoices${qs ? `?${qs}` : ""}`, {
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        invoices?: AdminInvoiceRow[];
        counts?: AdminInvoiceCounts;
        truncated?: boolean;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "No se pudieron cargar las facturas");
      }
      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      if (data.counts) setCounts(data.counts);
      setTruncated(data.truncated === true);
    } catch (e) {
      toast({
        title: "No se pudieron cargar las facturas",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [search, status, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadPdf = async (row: AdminInvoiceRow) => {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/invoices/${encodeURIComponent(row.id)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "La factura todavía no está disponible");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const voucher = voucherLabel(row)?.replace(/\s+/g, "-");
      a.download = voucher ? `factura-${voucher}.pdf` : `factura-${row.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({
        title: "No se pudo bajar la factura",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const retryInvoice = async (row: AdminInvoiceRow) => {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/invoices/${encodeURIComponent(row.id)}`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; alreadyIssued?: boolean };
      if (!res.ok) {
        throw new Error(data.error || "No se pudo reintentar la emisión");
      }
      toast({
        title: data.alreadyIssued ? "La factura ya estaba emitida" : "Factura emitida",
        description: "Actualizamos el listado con el estado del Hub.",
      });
      await load();
    } catch (e) {
      toast({
        title: "No se pudo emitir",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Compras</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{counts.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Emitidas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-emerald-700">{counts.issued}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-amber-700">{counts.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sin emitir</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-destructive">
              {counts.failed + counts.none}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Facturas de Mercado Pago</CardTitle>
          <CardDescription>
            Estado de emisión ARCA vía Hub para cada compra acreditada. Los envíos se acreditan
            aunque la factura falle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium" htmlFor="invoice-search">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="invoice-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSearch(query);
                  }}
                  placeholder="Email, CUIT, CAE, paymentId…"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full space-y-2 lg:w-52">
              <label className="text-sm font-medium" htmlFor="invoice-status">
                Estado
              </label>
              <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
                <SelectTrigger id="invoice-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {ADMIN_INVOICE_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {adminInvoiceStatusLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setSearch(query)}>
                Filtrar
              </Button>
              <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Actualizar
              </Button>
            </div>
          </div>

          {truncated ? (
            <p className="text-xs text-muted-foreground">
              Se muestran las compras más recientes. Si no aparece un pago, buscalo por email o
              paymentId.
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Compra</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Factura</TableHead>
                  <TableHead>Comprobante</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Cargando facturas…
                    </TableCell>
                  </TableRow>
                ) : invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No hay compras que coincidan con el filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((row) => {
                    const busy = busyId === row.id;
                    const problem = row.error || row.reason;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {row.fecha
                            ? format(new Date(row.fecha), "dd/MM/yy HH:mm", { locale: es })
                            : "—"}
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <div className="font-medium leading-snug">
                            {row.userNombre || row.buyerRazonSocial || "Sin nombre"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.userEmail || row.buyerEmail || row.userId || "—"}
                          </div>
                          {row.buyerCuit ? (
                            <div className="text-xs text-muted-foreground">CUIT {row.buyerCuit}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <div className="truncate text-sm" title={row.descripcion}>
                            {row.descripcion || "Compra de envíos"}
                          </div>
                          {row.paymentId ? (
                            <div className="font-mono text-[11px] text-muted-foreground">
                              MP {row.paymentId}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.monto > 0 ? formatMoney(row.monto) : "—"}
                        </TableCell>
                        <TableCell>
                          {statusBadge(row.status)}
                          {problem && row.status !== "issued" ? (
                            <p className="mt-1 max-w-[220px] text-xs text-destructive" title={problem}>
                              {problem}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.status === "issued" ? (
                            <div>
                              <div className="font-medium">{voucherLabel(row) || "Emitida"}</div>
                              {row.cae ? (
                                <div className="font-mono text-[11px] text-muted-foreground">
                                  CAE {row.cae}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {row.status === "issued" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void downloadPdf(row)}
                              >
                                {busy ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="mr-1 h-3.5 w-3.5" />
                                )}
                                PDF
                              </Button>
                            ) : row.paymentId ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void retryInvoice(row)}
                              >
                                {busy ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                )}
                                Reintentar
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
