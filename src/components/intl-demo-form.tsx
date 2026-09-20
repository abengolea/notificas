"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
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
import { COLOMBIA_PRIVACY_PATH } from "@/lib/colombia-site";
import { MARKETING_COUNTRIES } from "@/lib/marketing/countries";

const fieldClass =
  "border-white/25 bg-white/10 text-white placeholder:text-white/55 ring-offset-[hsl(208_38%_20%)]";

export function IntlDemoForm() {
  const { toast } = useToast();
  const [nombre, setNombre] = useState("");
  const [compania, setCompania] = useState("");
  const [email, setEmail] = useState("");
  const [pais, setPais] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [aceptoPrivacidad, setAceptoPrivacidad] = useState(false);
  const [sending, setSending] = useState(false);
  const isColombia = pais === "CO";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nombre.trim() || !email.trim() || !pais) {
      toast({
        variant: "destructive",
        title: "Faltan datos",
        description: "Completá nombre, email y país.",
      });
      return;
    }
    if (isColombia && !aceptoPrivacidad) {
      toast({
        variant: "destructive",
        title: "Tratamiento de datos",
        description: "Para Colombia hay que aceptar la política de datos.",
      });
      return;
    }
    setSending(true);
    try {
      const mercado = pais === "BR" || pais === "CO" ? pais : "AR";
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          compania: compania.trim(),
          email: email.trim(),
          mensaje: mensaje.trim(),
          tipoConsulta: "demostracion",
          mercado,
          pais,
          aceptoPrivacidad: isColombia ? aceptoPrivacidad : false,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "No se pudo enviar",
          description: data.error || "Intentá de nuevo en unos minutos.",
        });
        return;
      }
      toast({
        title: "Pedido enviado",
        description: "Te escribimos para coordinar una demostración.",
      });
      setNombre("");
      setCompania("");
      setEmail("");
      setPais("");
      setMensaje("");
      setAceptoPrivacidad(false);
    } catch {
      toast({
        variant: "destructive",
        title: "Error de red",
        description: "Comprobá la conexión e intentá otra vez.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="intl-nombre" className="mb-1.5 block text-sm text-white">
            Nombre
          </Label>
          <Input
            id="intl-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="name"
            disabled={sending}
            className={fieldClass}
          />
        </div>
        <div>
          <Label htmlFor="intl-email" className="mb-1.5 block text-sm text-white">
            Email
          </Label>
          <Input
            id="intl-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={sending}
            className={fieldClass}
          />
        </div>
        <div>
          <Label htmlFor="intl-empresa" className="mb-1.5 block text-sm text-white">
            Empresa
          </Label>
          <Input
            id="intl-empresa"
            value={compania}
            onChange={(e) => setCompania(e.target.value)}
            autoComplete="organization"
            disabled={sending}
            className={fieldClass}
          />
        </div>
        <div>
          <Label htmlFor="intl-pais" className="mb-1.5 block text-sm text-white">
            País
          </Label>
          <Select value={pais || undefined} onValueChange={setPais} disabled={sending}>
            <SelectTrigger id="intl-pais" className={fieldClass} aria-label="País">
              <SelectValue placeholder="Elegí el país de la operación" />
            </SelectTrigger>
            <SelectContent>
              {MARKETING_COUNTRIES.map((row) => (
                <SelectItem key={row.code} value={row.code}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="intl-mensaje" className="mb-1.5 block text-sm text-white">
          Qué necesitás comunicar
        </Label>
        <Textarea
          id="intl-mensaje"
          rows={3}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          disabled={sending}
          className={`${fieldClass} min-h-[88px]`}
        />
      </div>
      {isColombia ? (
        <label className="flex items-start gap-2 text-sm leading-relaxed text-[hsl(186_18%_86%)]">
          <input
            type="checkbox"
            className="mt-1"
            checked={aceptoPrivacidad}
            onChange={(e) => setAceptoPrivacidad(e.target.checked)}
          />
          <span>
            Acepto la{" "}
            <a href={COLOMBIA_PRIVACY_PATH} className="underline underline-offset-4">
              Política de Tratamiento de Datos
            </a>
            .
          </span>
        </label>
      ) : null}
      <Button type="submit" size="lg" disabled={sending} className="w-full sm:w-auto">
        {sending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Enviando…
          </>
        ) : (
          "Coordinar una demostración"
        )}
      </Button>
    </form>
  );
}
