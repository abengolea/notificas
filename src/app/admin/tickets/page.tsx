"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminAuth } from "@/components/admin/admin-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  RECLAMO_ESTADOS,
  reclamoEstadoLabel,
  type Reclamo,
  type ReclamoEstado,
} from "@/lib/reclamos";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Phone } from "lucide-react";

function TicketsAdminContent() {
  const { toast } = useToast();
  const [reclamos, setReclamos] = useState<Reclamo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adminNotas, setAdminNotas] = useState("");
  const [saving, setSaving] = useState(false);

  const loadReclamos = useCallback(async () => {
    try {
      setLoading(true);
      const params =
        filterEstado !== "all" ? `?estado=${encodeURIComponent(filterEstado)}` : "";
      const res = await fetch(`/api/admin/reclamos${params}`, {
        credentials: "include",
      });
      if (!res.ok) {
        console.error("Error cargando reclamos:", res.status, await res.text());
        setReclamos([]);
        return;
      }
      const data = await res.json();
      const raw = Array.isArray(data.reclamos) ? data.reclamos : [];
      setReclamos(raw as Reclamo[]);
    } catch (error) {
      console.error("Error cargando reclamos:", error);
    } finally {
      setLoading(false);
    }
  }, [filterEstado]);

  useEffect(() => {
    loadReclamos();
  }, [loadReclamos]);

  const selected = reclamos.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setAdminNotas(selected.adminNotas || "");
    } else {
      setAdminNotas("");
    }
  }, [selected]);

  const filteredReclamos = reclamos.filter((r) => {
    const q = searchTerm.toLowerCase();
    return (
      (r.ticketNumber?.toLowerCase()?.includes(q) ?? false) ||
      (r.nombre?.toLowerCase()?.includes(q) ?? false) ||
      (r.email?.toLowerCase()?.includes(q) ?? false) ||
      (r.mensaje?.toLowerCase()?.includes(q) ?? false)
    );
  });

  const getEstadoBadge = (estado: ReclamoEstado) => {
    switch (estado) {
      case "nuevo":
        return <Badge className="bg-blue-600">Nuevo</Badge>;
      case "en_proceso":
        return <Badge className="bg-yellow-600">En proceso</Badge>;
      case "resuelto":
        return <Badge className="bg-green-600">Resuelto</Badge>;
      case "cerrado":
        return <Badge variant="secondary">Cerrado</Badge>;
    }
  };

  const formatDate = (timestamp?: string) => {
    if (!timestamp) return "N/A";
    try {
      return new Date(timestamp).toLocaleString("es-AR");
    } catch {
      return "N/A";
    }
  };

  const updateReclamo = async (id: string, estado?: ReclamoEstado, notas?: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/reclamos", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          ...(estado ? { estado } : {}),
          ...(notas !== undefined ? { adminNotas: notas } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        reclamo?: Reclamo;
      };
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "No se pudo actualizar el reclamo.",
        });
        return;
      }
      if (data.reclamo) {
        setReclamos((prev) =>
          prev.map((r) => (r.id === data.reclamo!.id ? (data.reclamo as Reclamo) : r)),
        );
        toast({ title: "Reclamo actualizado" });
      }
      await loadReclamos();
    } catch {
      toast({
        variant: "destructive",
        title: "Error de red",
        description: "No se pudo conectar con el servidor.",
      });
    } finally {
      setSaving(false);
    }
  };

  const countByEstado = (estado: ReclamoEstado) =>
    reclamos.filter((r) => r.estado === estado).length;

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando reclamos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Reclamos de clientes
        </h1>
        <p className="text-gray-600">
          Gestioná los reclamos enviados por consumidores. Al registrarse, se notifica
          automáticamente al admin y se envía acuse al cliente con número de ticket.
        </p>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Label htmlFor="search">Buscar</Label>
          <Input
            id="search"
            placeholder="Ticket, nombre, email o mensaje..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="sm:w-48">
          <Label htmlFor="estado">Filtrar por estado</Label>
          <select
            id="estado"
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos</option>
            {RECLAMO_ESTADOS.map((e) => (
              <option key={e} value={e}>
                {reclamoEstadoLabel(e)}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:w-auto">
          <Label>&nbsp;</Label>
          <Button onClick={loadReclamos} className="mt-1 w-full sm:w-auto">
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reclamos.length}</div>
          </CardContent>
        </Card>
        {RECLAMO_ESTADOS.map((estado) => (
          <Card key={estado}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {reclamoEstadoLabel(estado)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{countByEstado(estado)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          {filteredReclamos.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500">No hay reclamos que coincidan con los filtros</p>
              </CardContent>
            </Card>
          ) : (
            filteredReclamos.map((reclamo) => (
              <Card
                key={reclamo.id}
                className={`cursor-pointer transition-shadow hover:shadow-md ${
                  selectedId === reclamo.id ? "ring-2 ring-blue-500" : ""
                }`}
                onClick={() => setSelectedId(reclamo.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {getEstadoBadge(reclamo.estado)}
                        <span className="font-mono text-sm font-semibold text-primary">
                          {reclamo.ticketNumber}
                        </span>
                      </div>
                      <h3 className="font-semibold truncate">{reclamo.nombre}</h3>
                      <p className="text-sm text-gray-500 truncate">{reclamo.email}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatDate(reclamo.createdAt)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-600 line-clamp-2">{reclamo.mensaje}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          {selected ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  {getEstadoBadge(selected.estado)}
                  <CardTitle className="font-mono">{selected.ticketNumber}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium">{selected.nombre}</p>
                  <a
                    href={`mailto:${selected.email}`}
                    className="text-sm text-primary flex items-center gap-1 mt-1"
                  >
                    <Mail className="h-3 w-3" />
                    {selected.email}
                  </a>
                  {selected.telefono && (
                    <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                      <Phone className="h-3 w-3" />
                      {selected.telefono}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-gray-500">Mensaje del reclamo</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap bg-muted/40 p-3 rounded-md">
                    {selected.mensaje}
                  </p>
                </div>

                <div>
                  <Label className="text-xs text-gray-500">Fechas</Label>
                  <p className="text-sm">Creado: {formatDate(selected.createdAt)}</p>
                  <p className="text-sm">Actualizado: {formatDate(selected.updatedAt)}</p>
                </div>

                <div>
                  <Label htmlFor="admin-notas">Notas internas</Label>
                  <Textarea
                    id="admin-notas"
                    value={adminNotas}
                    onChange={(e) => setAdminNotas(e.target.value)}
                    rows={3}
                    className="mt-1"
                    placeholder="Notas del equipo de soporte..."
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={saving}
                    onClick={() => updateReclamo(selected.id, undefined, adminNotas)}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar notas"}
                  </Button>
                </div>

                <div>
                  <Label>Cambiar estado</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {RECLAMO_ESTADOS.map((estado) => (
                      <Button
                        key={estado}
                        size="sm"
                        variant={selected.estado === estado ? "default" : "outline"}
                        disabled={saving || selected.estado === estado}
                        onClick={() => updateReclamo(selected.id, estado)}
                      >
                        {reclamoEstadoLabel(estado)}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button variant="outline" className="w-full" asChild>
                  <a href={`mailto:${selected.email}?subject=Re:%20Ticket%20${selected.ticketNumber}`}>
                    Responder por email
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                Seleccioná un reclamo de la lista para ver el detalle y gestionarlo.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TicketsPage() {
  return (
    <AdminAuth>
      <TicketsAdminContent />
    </AdminAuth>
  );
}
