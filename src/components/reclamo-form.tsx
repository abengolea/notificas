"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2 } from "lucide-react";

export function ReclamoForm() {
  const { toast } = useToast();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [sending, setSending] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const n = nombre.trim();
    const em = email.trim();
    const tel = telefono.trim();
    const m = mensaje.trim();

    if (!n || !em || !m) {
      toast({
        variant: "destructive",
        title: "Faltan datos",
        description: "Completá nombre, correo y mensaje del reclamo.",
      });
      return;
    }

    if (m.length < 10) {
      toast({
        variant: "destructive",
        title: "Mensaje muy corto",
        description: "Describí tu reclamo con al menos 10 caracteres.",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      toast({
        variant: "destructive",
        title: "Correo no válido",
        description: "Revise el formato del email.",
      });
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/reclamos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: n,
          email: em,
          telefono: tel,
          mensaje: m,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        ticketNumber?: string;
        warning?: string;
      };

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "No se pudo enviar",
          description: data.error || "Intentá de nuevo en unos minutos.",
        });
        return;
      }

      setTicketNumber(data.ticketNumber || null);
      toast({
        title: "Reclamo registrado",
        description: data.ticketNumber
          ? `Tu número de ticket es ${data.ticketNumber}. Te enviamos un correo de confirmación.`
          : "Te enviamos un correo de confirmación.",
      });

      if (data.warning) {
        toast({
          title: "Aviso",
          description: data.warning,
        });
      }

      setNombre("");
      setEmail("");
      setTelefono("");
      setMensaje("");
    } catch {
      toast({
        variant: "destructive",
        title: "Error de red",
        description: "Comprobá tu conexión e intentá otra vez.",
      });
    } finally {
      setSending(false);
    }
  }

  if (ticketNumber) {
    return (
      <div className="p-6 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg text-center">
        <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" />
        <p className="font-semibold text-lg mb-1">¡Reclamo recibido!</p>
        <p className="text-sm text-muted-foreground mb-3">
          Te enviamos un correo de confirmación a tu email.
        </p>
        <p className="text-2xl font-bold text-primary">{ticketNumber}</p>
        <p className="text-xs text-muted-foreground mt-2">
          Conservá este número para futuras consultas.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => setTicketNumber(null)}
        >
          Enviar otro reclamo
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="reclamo-nombre">Nombre completo *</Label>
        <Input
          id="reclamo-nombre"
          name="nombre"
          autoComplete="name"
          value={nombre}
          onChange={(ev) => setNombre(ev.target.value)}
          disabled={sending}
          className="mt-1"
          required
        />
      </div>
      <div>
        <Label htmlFor="reclamo-email">Correo electrónico *</Label>
        <Input
          id="reclamo-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          disabled={sending}
          className="mt-1"
          required
        />
      </div>
      <div>
        <Label htmlFor="reclamo-telefono">Teléfono (opcional)</Label>
        <Input
          id="reclamo-telefono"
          name="telefono"
          type="tel"
          autoComplete="tel"
          value={telefono}
          onChange={(ev) => setTelefono(ev.target.value)}
          disabled={sending}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="reclamo-mensaje">Descripción del reclamo *</Label>
        <Textarea
          id="reclamo-mensaje"
          name="mensaje"
          rows={5}
          value={mensaje}
          onChange={(ev) => setMensaje(ev.target.value)}
          disabled={sending}
          className="mt-1"
          placeholder="Describí tu reclamo con el mayor detalle posible..."
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={sending}>
        {sending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Enviando reclamo…
          </>
        ) : (
          "Enviar reclamo"
        )}
      </Button>
    </form>
  );
}
