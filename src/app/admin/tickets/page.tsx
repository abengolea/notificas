"use client";

import { useState, useEffect } from "react";
import { AdminAuth } from "@/components/admin/admin-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmailTicket {
  id: string;
  to: string[];
  message: {
    subject: string;
    html: string;
  };
  recipientName?: string;
  recipientEmail?: string;
  from?: string;
  delivery?: {
    state: "SUCCESS" | "ERROR" | "PENDING";
    time?: unknown;
    info?: string;
    error?: string;
  };
  tracking?: {
    opened: boolean;
    openedAt?: unknown;
    readConfirmed: boolean;
    readConfirmedAt?: unknown;
    clickCount: number;
    openCount: number;
  };
  readerUrl?: string;
  createdAt?: unknown;
}

function TicketsAdminContent() {
  const [tickets, setTickets] = useState<EmailTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/mail-tickets", { credentials: "include" });
      if (!res.ok) {
        console.error("Error cargando tickets:", res.status, await res.text());
        setTickets([]);
        return;
      }
      const data = await res.json();
      const raw = Array.isArray(data.tickets) ? data.tickets : [];
      const ticketsData = raw.map((t: EmailTicket) => ({
        ...t,
        message: {
          subject: t.message?.subject || "Sin asunto",
          html: t.message?.html || "",
        },
        to: Array.isArray(t.to) ? t.to : [],
      })) as EmailTicket[];
      setTickets(ticketsData);
    } catch (error) {
      console.error("Error cargando tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (ticket.recipientName?.toLowerCase()?.includes(q) ?? false) ||
      (ticket.recipientEmail?.toLowerCase()?.includes(q) ?? false) ||
      (ticket.message?.subject?.toLowerCase()?.includes(q) ?? false);

    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "success" && ticket.delivery?.state === "SUCCESS") ||
      (filterStatus === "error" && ticket.delivery?.state === "ERROR") ||
      (filterStatus === "pending" &&
        (!ticket.delivery || ticket.delivery.state === "PENDING"));

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (ticket: EmailTicket) => {
    if (!ticket.delivery) return <Badge variant="secondary">PENDIENTE</Badge>;

    switch (ticket.delivery.state) {
      case "SUCCESS":
        return (
          <Badge variant="default" className="bg-green-600">
            ENVIADO
          </Badge>
        );
      case "ERROR":
        return <Badge variant="destructive">ERROR</Badge>;
      default:
        return <Badge variant="secondary">PENDIENTE</Badge>;
    }
  };

  const formatDate = (timestamp: unknown) => {
    if (timestamp === null || timestamp === undefined) return "N/A";
    try {
      if (typeof timestamp === "string") {
        const d = new Date(timestamp);
        if (!Number.isNaN(d.getTime())) return d.toLocaleString("es-ES");
      }
      const ts = timestamp as { toDate?: () => Date };
      const date = ts.toDate ? ts.toDate() : new Date(timestamp as string | number);
      return date.toLocaleString("es-ES");
    } catch {
      return "N/A";
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando tickets...</p>
        </div>
      </div>
    );
  }

  const toPreview = (t: EmailTicket) =>
    t.recipientEmail || (Array.isArray(t.to) ? t.to.join(", ") : "");

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Administración de Tickets</h1>
        <p className="text-gray-600">
          Gestiona y monitorea los últimos emails (vía servidor; no usa reglas cliente de Firestore).
        </p>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Label htmlFor="search">Buscar tickets</Label>
          <Input
            id="search"
            placeholder="Buscar por nombre, email o asunto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="sm:w-48">
          <Label htmlFor="status">Filtrar por estado</Label>
          <select
            id="status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los estados</option>
            <option value="success">Enviados</option>
            <option value="error">Con error</option>
            <option value="pending">Pendientes</option>
          </select>
        </div>

        <div className="sm:w-auto">
          <Label>&nbsp;</Label>
          <Button onClick={loadTickets} className="mt-1 w-full sm:w-auto">
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tickets.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Enviados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {tickets.filter((t) => t.delivery?.state === "SUCCESS").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Con Error</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {tickets.filter((t) => t.delivery?.state === "ERROR").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {
                tickets.filter((t) => !t.delivery || t.delivery.state === "PENDING")
                  .length
              }
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">No se encontraron tickets que coincidan con los filtros</p>
            </CardContent>
          </Card>
        ) : (
          filteredTickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusBadge(ticket)}
                      <span className="text-sm text-gray-500">
                        ID: {ticket.id.slice(0, 8)}...
                      </span>
                    </div>
                    <h3 className="font-semibold text-lg">{ticket.message.subject}</h3>
                    <p className="text-sm text-gray-600">
                      Para: {ticket.recipientName || "N/A"} ({toPreview(ticket)})
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div>Creado: {formatDate(ticket.createdAt)}</div>
                    {Boolean(ticket.delivery?.time) && (
                      <div>Enviado: {formatDate(ticket.delivery?.time)}</div>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Remitente:</span>
                    <p className="text-gray-600">{ticket.from || "contacto@notificas.com"}</p>
                  </div>

                  <div>
                    <span className="font-medium">Tracking:</span>
                    <div className="text-gray-600">
                      <div>Abierto: {ticket.tracking?.opened ? "✅" : "❌"}</div>
                      <div>Clicks: {ticket.tracking?.clickCount || 0}</div>
                      <div>Lectura confirmada: {ticket.tracking?.readConfirmed ? "✅" : "❌"}</div>
                    </div>
                  </div>

                  <div>
                    <span className="font-medium">Acciones:</span>
                    <div className="flex gap-2 mt-1">
                      {ticket.readerUrl && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={ticket.readerUrl} target="_blank" rel="noopener noreferrer">
                            Ver contenido
                          </a>
                        </Button>
                      )}
                      {ticket.delivery?.error && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => alert(ticket.delivery?.error)}
                        >
                          Ver error
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
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
