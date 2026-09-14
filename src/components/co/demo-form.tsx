"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { colombiaCopy } from "@/lib/colombia-content";
import {
  COLOMBIA_ORG_OPTIONS,
  COLOMBIA_PRIVACY_PATH,
  COLOMBIA_VOLUME_OPTIONS,
  type ColombiaOrgValue,
  type ColombiaVolumeValue,
} from "@/lib/colombia-site";
import { cn } from "@/lib/utils";

const CONTACT_EMAIL = "contacto@notificas.com";
const inputClass = "border-input bg-background dark:border-white/20 dark:bg-transparent";

function FieldLabel({
  htmlFor,
  children,
  optional,
}: {
  htmlFor: string;
  children: string;
  optional?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-foreground">
      {children}
      {optional ? (
        <span className="ml-1 font-normal text-muted-foreground">
          ({colombiaCopy.demo.fields.procesoOptional})
        </span>
      ) : null}
    </label>
  );
}

export function DemoForm() {
  const copy = colombiaCopy.demo;
  const { toast } = useToast();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tipo, setTipo] = useState<ColombiaOrgValue | "">("");
  const [volumen, setVolumen] = useState<ColombiaVolumeValue | "">("");
  const [proceso, setProceso] = useState("");
  const [acepto, setAcepto] = useState(false);
  const [pedido, setPedido] = useState<"demostracion" | "cotizacion">("demostracion");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pedido") === "propuesta") setPedido("cotizacion");
  }, []);

  const volumeLabel = useMemo(
    () => COLOMBIA_VOLUME_OPTIONS.find((item) => item.value === volumen)?.label ?? "",
    [volumen]
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const first = nombre.trim();
    const last = apellido.trim();
    const company = empresa.trim();
    const em = email.trim();

    if (!first || !last || !company || !cargo.trim() || !em || !tipo || !volumen || !acepto) {
      toast({
        variant: "destructive",
        title: copy.errorTitle,
        description: copy.errorFields,
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      toast({
        variant: "destructive",
        title: copy.errorTitle,
        description: copy.errorEmail,
      });
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: first,
          apellido: last,
          compania: company,
          cargo: cargo.trim(),
          email: em,
          telefono: telefono.trim(),
          volumenEstimado: volumeLabel,
          tipoConsulta: pedido,
          mercado: "CO",
          tipoOrganizacion: tipo,
          mensaje: proceso.trim(),
          aceptoPrivacidad: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: copy.errorTitle,
          description:
            data.error ||
            (res.status === 503
              ? `El servidor de correo no está configurado. Escríbanos a ${CONTACT_EMAIL}.`
              : "Intente de nuevo en unos minutos."),
        });
        return;
      }

      toast({ title: copy.successTitle, description: copy.successBody });
      setNombre("");
      setApellido("");
      setEmpresa("");
      setCargo("");
      setEmail("");
      setTelefono("");
      setTipo("");
      setVolumen("");
      setProceso("");
      setAcepto(false);
    } catch {
      toast({
        variant: "destructive",
        title: copy.errorTitle,
        description: copy.errorNetwork,
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="demostracion" className="scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
      <div className="container grid items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div>
          <h2 className="section-title mb-4 max-w-[20ch] whitespace-pre-line">{copy.title}</h2>
          <p className="max-w-[54ch] leading-relaxed text-muted-foreground">{copy.body}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border bg-card p-5 sm:p-8"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="co-nombre">{copy.fields.nombre}</FieldLabel>
              <Input
                id="co-nombre"
                name="nombre"
                autoComplete="given-name"
                value={nombre}
                onChange={(ev) => setNombre(ev.target.value)}
                disabled={sending}
                className={inputClass}
                required
              />
            </div>
            <div>
              <FieldLabel htmlFor="co-apellido">{copy.fields.apellido}</FieldLabel>
              <Input
                id="co-apellido"
                name="apellido"
                autoComplete="family-name"
                value={apellido}
                onChange={(ev) => setApellido(ev.target.value)}
                disabled={sending}
                className={inputClass}
                required
              />
            </div>
            <div>
              <FieldLabel htmlFor="co-empresa">{copy.fields.empresa}</FieldLabel>
              <Input
                id="co-empresa"
                name="empresa"
                autoComplete="organization"
                value={empresa}
                onChange={(ev) => setEmpresa(ev.target.value)}
                disabled={sending}
                className={inputClass}
                required
              />
            </div>
            <div>
              <FieldLabel htmlFor="co-cargo">{copy.fields.cargo}</FieldLabel>
              <Input
                id="co-cargo"
                name="cargo"
                autoComplete="organization-title"
                value={cargo}
                onChange={(ev) => setCargo(ev.target.value)}
                disabled={sending}
                className={inputClass}
                required
              />
            </div>
            <div>
              <FieldLabel htmlFor="co-email">{copy.fields.email}</FieldLabel>
              <Input
                id="co-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                disabled={sending}
                className={inputClass}
                required
              />
            </div>
            <div>
              <FieldLabel htmlFor="co-telefono">{copy.fields.telefono}</FieldLabel>
              <Input
                id="co-telefono"
                name="telefono"
                type="tel"
                autoComplete="tel"
                value={telefono}
                onChange={(ev) => setTelefono(ev.target.value)}
                disabled={sending}
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-4">
            <FieldLabel htmlFor="co-tipo">{copy.fields.tipo}</FieldLabel>
            <Select
              value={tipo || undefined}
              onValueChange={(value) => setTipo(value as ColombiaOrgValue)}
              disabled={sending}
            >
              <SelectTrigger id="co-tipo" className={inputClass} aria-label={copy.fields.tipo}>
                <SelectValue placeholder="Seleccione" />
              </SelectTrigger>
              <SelectContent>
                {COLOMBIA_ORG_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4">
            <FieldLabel htmlFor="co-volumen">{copy.fields.volumen}</FieldLabel>
            <Select
              value={volumen || undefined}
              onValueChange={(value) => setVolumen(value as ColombiaVolumeValue)}
              disabled={sending}
            >
              <SelectTrigger id="co-volumen" className={inputClass} aria-label={copy.fields.volumen}>
                <SelectValue placeholder="Seleccione" />
              </SelectTrigger>
              <SelectContent>
                {COLOMBIA_VOLUME_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4">
            <FieldLabel htmlFor="co-proceso" optional>
              {copy.fields.proceso}
            </FieldLabel>
            <Textarea
              id="co-proceso"
              name="proceso"
              rows={4}
              value={proceso}
              onChange={(ev) => setProceso(ev.target.value)}
              disabled={sending}
              className={cn(inputClass, "min-h-[6.5rem]")}
            />
          </div>

          <div className="mt-5 flex items-start gap-3">
            <Checkbox
              id="co-privacidad"
              checked={acepto}
              onCheckedChange={(value) => setAcepto(value === true)}
              disabled={sending}
              className="mt-0.5"
            />
            <label htmlFor="co-privacidad" className="text-sm leading-relaxed text-foreground">
              {copy.privacyPrefix}{" "}
              <Link href={COLOMBIA_PRIVACY_PATH} className="font-medium underline underline-offset-4">
                {copy.privacyLink}
              </Link>
              .
            </label>
          </div>

          <Button type="submit" className="mt-6 w-full" disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {copy.sending}
              </>
            ) : (
              copy.submit
            )}
          </Button>
        </form>
      </div>
    </section>
  );
}
