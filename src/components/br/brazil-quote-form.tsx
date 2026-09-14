"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  BRAZIL_FINALIDADE_OPTIONS,
  BRAZIL_VOLUME_OPTIONS,
  type BrazilFinalidadeValue,
  type BrazilVolumeValue,
} from "@/lib/brazil-site";
import { cn } from "@/lib/utils";

const CONTACT_EMAIL = "contacto@notificas.com";

const inputClass =
  "border-input bg-background dark:border-white/20 dark:bg-transparent";

type CanalBr = "email" | "whatsapp" | "ambos" | "";
type PedidoBr = "cotizacion" | "demostracion";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-foreground">
      {children}
    </label>
  );
}

export function BrazilQuoteForm() {
  const { toast } = useToast();
  const [empresa, setEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [volume, setVolume] = useState<BrazilVolumeValue | "">("");
  const [canal, setCanal] = useState<CanalBr>("");
  const [finalidade, setFinalidade] = useState<BrazilFinalidadeValue[]>([]);
  const [pedido, setPedido] = useState<PedidoBr>("cotizacion");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pedido") === "demonstracao") {
      setPedido("demostracion");
    }
  }, []);

  const volumeLabel = useMemo(
    () => BRAZIL_VOLUME_OPTIONS.find((item) => item.value === volume)?.label ?? "",
    [volume]
  );

  function toggleFinalidade(value: BrazilFinalidadeValue, checked: boolean) {
    setFinalidade((current) =>
      checked ? [...current, value] : current.filter((item) => item !== value)
    );
  }

  function toggleCanal(next: "email" | "whatsapp", checked: boolean) {
    const emailOn = next === "email" ? checked : canal === "email" || canal === "ambos";
    const waOn = next === "whatsapp" ? checked : canal === "whatsapp" || canal === "ambos";
    if (emailOn && waOn) setCanal("ambos");
    else if (emailOn) setCanal("email");
    else if (waOn) setCanal("whatsapp");
    else setCanal("");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const company = empresa.trim();
    const person = nome.trim();
    const em = email.trim();
    const taxId = digitsOnly(cnpj);

    if (!company || !person || !em) {
      toast({
        variant: "destructive",
        title: "Faltam dados",
        description: "Informe empresa, nome e e-mail corporativo.",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      toast({
        variant: "destructive",
        title: "E-mail inválido",
        description: "Revise o formato do e-mail corporativo.",
      });
      return;
    }

    if (taxId && taxId.length !== 14) {
      toast({
        variant: "destructive",
        title: "CNPJ inválido",
        description: "Informe um CNPJ com 14 dígitos.",
      });
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: person,
          compania: company,
          email: em,
          telefono: whatsapp.trim(),
          volumenEstimado: volumeLabel,
          canal,
          tipoConsulta: pedido,
          mercado: "BR",
          cnpj: cnpj.trim(),
          cargo: cargo.trim(),
          finalidade,
          mensaje: "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Não foi possível enviar",
          description:
            data.error ||
            (res.status === 503
              ? `O servidor de e-mail não está configurado. Escreva para ${CONTACT_EMAIL}.`
              : "Tente de novo em alguns minutos."),
        });
        return;
      }

      toast({
        title: pedido === "demostracion" ? "Pedido de demonstração enviado" : "Pedido de cotação enviado",
        description: "Entraremos em contato para avaliar o volume e o canal.",
      });
      setEmpresa("");
      setCnpj("");
      setNome("");
      setCargo("");
      setEmail("");
      setWhatsapp("");
      setVolume("");
      setCanal("");
      setFinalidade([]);
    } catch {
      toast({
        variant: "destructive",
        title: "Erro de rede",
        description: "Verifique a conexão e tente novamente.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="br-empresa">Empresa</FieldLabel>
          <Input
            id="br-empresa"
            name="empresa"
            autoComplete="organization"
            value={empresa}
            onChange={(ev) => setEmpresa(ev.target.value)}
            disabled={sending}
            className={inputClass}
          />
        </div>
        <div>
          <FieldLabel htmlFor="br-cnpj">CNPJ</FieldLabel>
          <Input
            id="br-cnpj"
            name="cnpj"
            inputMode="numeric"
            autoComplete="off"
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(ev) => setCnpj(ev.target.value)}
            disabled={sending}
            className={inputClass}
          />
        </div>
        <div>
          <FieldLabel htmlFor="br-nome">Nome</FieldLabel>
          <Input
            id="br-nome"
            name="nome"
            autoComplete="name"
            value={nome}
            onChange={(ev) => setNome(ev.target.value)}
            disabled={sending}
            className={inputClass}
          />
        </div>
        <div>
          <FieldLabel htmlFor="br-cargo">Cargo</FieldLabel>
          <Input
            id="br-cargo"
            name="cargo"
            autoComplete="organization-title"
            value={cargo}
            onChange={(ev) => setCargo(ev.target.value)}
            disabled={sending}
            className={inputClass}
          />
        </div>
        <div>
          <FieldLabel htmlFor="br-email">E-mail corporativo</FieldLabel>
          <Input
            id="br-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            disabled={sending}
            className={inputClass}
          />
        </div>
        <div>
          <FieldLabel htmlFor="br-whatsapp">WhatsApp</FieldLabel>
          <Input
            id="br-whatsapp"
            name="whatsapp"
            type="tel"
            autoComplete="tel"
            value={whatsapp}
            onChange={(ev) => setWhatsapp(ev.target.value)}
            disabled={sending}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="br-volume">Volume mensal estimado</FieldLabel>
        <Select
          value={volume || undefined}
          onValueChange={(value) => setVolume(value as BrazilVolumeValue)}
          disabled={sending}
        >
          <SelectTrigger id="br-volume" className={inputClass} aria-label="Volume mensal estimado">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {BRAZIL_VOLUME_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">Canal</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={canal === "email" || canal === "ambos"}
              onChange={(ev) => toggleCanal("email", ev.target.checked)}
              disabled={sending}
            />
            E-mail
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={canal === "whatsapp" || canal === "ambos"}
              onChange={(ev) => toggleCanal("whatsapp", ev.target.checked)}
              disabled={sending}
            />
            WhatsApp
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={canal === "ambos"}
              onChange={(ev) => setCanal(ev.target.checked ? "ambos" : "")}
              disabled={sending}
            />
            Ambos
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">Finalidade</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {BRAZIL_FINALIDADE_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={finalidade.includes(option.value)}
                onChange={(ev) => toggleFinalidade(option.value, ev.target.checked)}
                disabled={sending}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">O que você precisa</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="pedido"
              className="h-4 w-4 accent-primary"
              checked={pedido === "cotizacion"}
              onChange={() => setPedido("cotizacion")}
              disabled={sending}
            />
            Cotação
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="pedido"
              className="h-4 w-4 accent-primary"
              checked={pedido === "demostracion"}
              onChange={() => setPedido("demostracion")}
              disabled={sending}
            />
            Demonstração
          </label>
        </div>
      </fieldset>

      <Button type="submit" className={cn("w-full")} disabled={sending}>
        {sending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Enviando…
          </>
        ) : pedido === "demostracion" ? (
          "Solicitar demonstração"
        ) : (
          "Receber cotação"
        )}
      </Button>
    </form>
  );
}
