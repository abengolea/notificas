"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const CONTACT_EMAIL = "contacto@notificas.com";

const inputClass =
  "bg-background/20 border-border/50 text-foreground placeholder:text-background/50";

export function FooterContactForm() {
  const { toast } = useToast();
  const [nombre, setNombre] = useState("");
  const [compania, setCompania] = useState("");
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const n = nombre.trim();
    const c = compania.trim();
    const em = email.trim();
    const m = mensaje.trim();

    if (!n || !em) {
      toast({
        variant: "destructive",
        title: "Faltan datos",
        description: "Indique nombre y correo electrónico.",
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
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: n,
          compania: c,
          email: em,
          mensaje: m,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "No se pudo enviar",
          description:
            data.error ||
            (res.status === 503
              ? `El servidor no tiene configurado el correo. Escribinos a ${CONTACT_EMAIL}.`
              : "Intentá de nuevo en unos minutos."),
        });
        return;
      }

      toast({
        title: "Mensaje enviado",
        description: "Te responderemos a la brevedad.",
      });
      setNombre("");
      setCompania("");
      setEmail("");
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="footer-nombre" className="sr-only">
          Nombre
        </Label>
        <Input
          id="footer-nombre"
          name="nombre"
          placeholder="Nombre"
          autoComplete="name"
          value={nombre}
          onChange={(ev) => setNombre(ev.target.value)}
          disabled={sending}
          aria-label="Nombre"
          className={inputClass}
        />
      </div>
      <div>
        <Label htmlFor="footer-compania" className="sr-only">
          Compañía
        </Label>
        <Input
          id="footer-compania"
          name="compania"
          placeholder="Compañía"
          autoComplete="organization"
          value={compania}
          onChange={(ev) => setCompania(ev.target.value)}
          disabled={sending}
          aria-label="Compañía"
          className={inputClass}
        />
      </div>
      <div>
        <Label htmlFor="footer-email" className="sr-only">
          Email
        </Label>
        <Input
          id="footer-email"
          name="email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          disabled={sending}
          aria-label="Correo electrónico"
          className={inputClass}
        />
      </div>
      <div>
        <Label htmlFor="footer-mensaje" className="sr-only">
          Mensaje
        </Label>
        <Textarea
          id="footer-mensaje"
          name="mensaje"
          placeholder="Mensaje (opcional)"
          rows={3}
          value={mensaje}
          onChange={(ev) => setMensaje(ev.target.value)}
          disabled={sending}
          className={`${inputClass} min-h-[72px] text-foreground md:text-sm`}
          aria-label="Mensaje opcional"
        />
      </div>
      <Button type="submit" className="w-full" disabled={sending}>
        {sending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Enviando…
          </>
        ) : (
          "Enviar"
        )}
      </Button>
    </form>
  );
}
