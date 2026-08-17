"use client";

import { useState, type FormEvent } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const CONTACT_EMAIL = "contacto@notificas.com";

const footerInputClass =
  "border-background/25 bg-background/10 text-background placeholder:text-background/55";

type ContactFormVariant = "footer" | "quote";
type CanalCotizacion = "" | "whatsapp" | "email" | "ambos";

function ContactForm({ variant }: { variant: ContactFormVariant }) {
  const { toast } = useToast();
  const isQuote = variant === "quote";
  const [nombre, setNombre] = useState("");
  const [compania, setCompania] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [volumenEstimado, setVolumenEstimado] = useState("");
  const [canal, setCanal] = useState<CanalCotizacion>("");
  const [mensaje, setMensaje] = useState("");
  const [sending, setSending] = useState(false);

  const inputClass = isQuote ? undefined : footerInputClass;
  const labelClass = isQuote
    ? "mb-1.5 block text-sm font-medium text-foreground"
    : "sr-only";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const n = nombre.trim();
    const c = compania.trim();
    const em = email.trim();
    const m = mensaje.trim();
    const tel = telefono.trim();
    const vol = volumenEstimado.trim();

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
          telefono: tel,
          volumenEstimado: vol,
          canal,
          tipoConsulta: isQuote ? "cotizacion" : "general",
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
        title: isQuote ? "Solicitud enviada" : "Mensaje enviado",
        description: isQuote
          ? "Te contactaremos para evaluar el volumen y cotizar el servicio."
          : "Te responderemos a la brevedad.",
      });
      setNombre("");
      setCompania("");
      setEmail("");
      setTelefono("");
      setVolumenEstimado("");
      setCanal("");
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
      <div className={isQuote ? "grid gap-4 sm:grid-cols-2" : "space-y-4"}>
        <div>
          <Label htmlFor={`${variant}-nombre`} className={labelClass}>
            Nombre
          </Label>
          <Input
            id={`${variant}-nombre`}
            name="nombre"
            placeholder={isQuote ? undefined : "Nombre"}
            autoComplete="name"
            value={nombre}
            onChange={(ev) => setNombre(ev.target.value)}
            disabled={sending}
            aria-label="Nombre"
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor={`${variant}-compania`} className={labelClass}>
            Empresa
          </Label>
          <Input
            id={`${variant}-compania`}
            name="compania"
            placeholder={isQuote ? undefined : "Compañía"}
            autoComplete="organization"
            value={compania}
            onChange={(ev) => setCompania(ev.target.value)}
            disabled={sending}
            aria-label="Empresa"
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor={`${variant}-email`} className={labelClass}>
            Email
          </Label>
          <Input
            id={`${variant}-email`}
            name="email"
            type="email"
            placeholder={isQuote ? undefined : "Email"}
            autoComplete="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            disabled={sending}
            aria-label="Correo electrónico"
            className={inputClass}
          />
        </div>
        {isQuote ? (
          <div>
            <Label htmlFor={`${variant}-telefono`} className={labelClass}>
              Teléfono
            </Label>
            <Input
              id={`${variant}-telefono`}
              name="telefono"
              type="tel"
              placeholder="Opcional"
              autoComplete="tel"
              value={telefono}
              onChange={(ev) => setTelefono(ev.target.value)}
              disabled={sending}
              aria-label="Teléfono"
            />
          </div>
        ) : null}
      </div>
      {isQuote ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${variant}-volumen`} className={labelClass}>
              Volumen estimado
            </Label>
            <Input
              id={`${variant}-volumen`}
              name="volumenEstimado"
              placeholder="Ej.: 500, 5.000"
              value={volumenEstimado}
              onChange={(ev) => setVolumenEstimado(ev.target.value)}
              disabled={sending}
              aria-label="Volumen estimado de notificaciones"
            />
          </div>
          <div>
            <Label htmlFor={`${variant}-canal`} className={labelClass}>
              Canal
            </Label>
            <Select
              value={canal || undefined}
              onValueChange={(v) => setCanal(v as CanalCotizacion)}
              disabled={sending}
            >
              <SelectTrigger id={`${variant}-canal`} aria-label="Canal">
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="ambos">WhatsApp + Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}
      <div>
        <Label htmlFor={`${variant}-mensaje`} className={labelClass}>
          {isQuote ? "Descripción de la necesidad" : "Mensaje"}
        </Label>
        <Textarea
          id={`${variant}-mensaje`}
          name="mensaje"
          placeholder={
            isQuote
              ? "Opcional: tipo de comunicación y cualquier dato útil"
              : "Mensaje (opcional)"
          }
          rows={isQuote ? 4 : 3}
          value={mensaje}
          onChange={(ev) => setMensaje(ev.target.value)}
          disabled={sending}
          className={cn(
            inputClass,
            "min-h-[72px] md:text-sm"
          )}
          aria-label={isQuote ? "Descripción de la necesidad" : "Mensaje opcional"}
        />
      </div>
      <Button type="submit" className="w-full" disabled={sending}>
        {sending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Enviando…
          </>
        ) : isQuote ? (
          "Solicitar cotización"
        ) : (
          "Enviar"
        )}
      </Button>
    </form>
  );
}

export function FooterContactForm() {
  return <ContactForm variant="footer" />;
}

export function QuoteContactForm() {
  return <ContactForm variant="quote" />;
}
