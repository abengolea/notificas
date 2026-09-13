"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type InvitePayload = {
  art: { name: string; logoUrl: string | null };
  contact: { phone?: string; email?: string };
  identity: { dni?: string; cuil?: string; fullName?: string; hasPrefilled: boolean };
  status: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  identityStatus: string;
  terms: { title: string; content: string; version: string; hash: string };
  copy: { intro: string };
};

type SentOtp = {
  challengeId: string;
  channel: string;
  expiresAt: string;
  destinationMasked: string;
};

const STEPS = ["Datos", "WhatsApp", "Adhesión", "Listo"];

export default function AdherirPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [data, setData] = useState<InvitePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [dni, setDni] = useState("");
  const [cuil, setCuil] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsappChallenge, setWhatsappChallenge] = useState<SentOtp | null>(null);
  const [whatsappCode, setWhatsappCode] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ adhesionId: string; manageUrl: string; manageToken: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/art/public/invite/${token}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error === "expired" ? "Este enlace venció." : "No encontramos la invitación.");
        return;
      }
      setData(json as InvitePayload);
    })();
  }, [token]);

  const progress = useMemo(() => Math.round(((done ? 3 : step) / 3) * 100), [step, done]);

  function otpErrorMessage(code: string | undefined): string {
    if (code === "identity_mismatch") return "Los datos no coinciden.";
    if (code === "invalid") return "Código incorrecto.";
    if (code === "expired") return "El código venció. Pedí uno nuevo.";
    if (code === "max_attempts") return "Demasiados intentos.";
    if (code === "phone_required_for_otp") return "Falta el celular para enviar WhatsApp.";
    return "No se pudo enviar o verificar el código de WhatsApp.";
  }

  async function sendOtp() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/art/public/invite/${token}/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "phone", dni, cuil, fullName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(otpErrorMessage(json.error));
      const sent: SentOtp | null = json.whatsapp || (json.challengeId
        ? { challengeId: json.challengeId, channel: json.channel, expiresAt: json.expiresAt, destinationMasked: json.destinationMasked }
        : null);
      if (!sent?.challengeId) throw new Error("No pudimos enviar el código de WhatsApp.");
      setWhatsappChallenge(sent);
      setWhatsappCode("");
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if (!whatsappChallenge) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/art/public/invite/${token}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: whatsappChallenge.challengeId, code: whatsappCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(otpErrorMessage(json.error));
      if (json.purpose !== "phone") throw new Error("Ese código no corresponde a WhatsApp.");
      const idRes = await fetch(`/api/art/public/invite/${token}/identity`, { method: "POST" });
      const idJson = await idRes.json().catch(() => ({}));
      if (idJson.identityStatus === "pending") {
        setStep(2);
        setError("Tu identidad quedó pendiente de un proveedor externo. La ART puede prevalidarla o se conectará RENAPER/Didit más adelante.");
        return;
      }
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    if (!accepted) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/art/public/invite/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true, otpChallengeId: whatsappChallenge?.challengeId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error("No se pudo registrar la adhesión. Revisá los pasos anteriores.");
      setDone({ adhesionId: json.adhesionId, manageUrl: json.manageUrl, manageToken: json.manageToken });
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
        <p className="text-center text-base text-muted-foreground">{error}</p>
      </main>
    );
  }

  if (!data) {
    return <main className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Cargando…</main>;
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 py-8">
      <div className="mb-6 flex items-center gap-3">
        {data.art.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.art.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {data.art.name.slice(0, 1)}
          </div>
        )}
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Notificaciones electrónicas</p>
          <h1 className="text-lg font-semibold">{data.art.name}</h1>
        </div>
      </div>

      <ol className="mb-6 flex gap-1">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <div className={cn("h-1 rounded-full", i <= (done ? 3 : step) ? "bg-primary" : "bg-muted")} />
            <p className="mt-1 hidden text-[10px] text-muted-foreground sm:block">{label}</p>
          </li>
        ))}
      </ol>
      <p className="sr-only">Progreso {progress}%</p>

      {done ? (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Tu adhesión fue registrada correctamente.</h2>
          <p className="text-sm text-muted-foreground">Constancia {done.adhesionId}</p>
          <Button asChild className="w-full">
            <a href={`/api/art/public/evidence/${done.manageToken}`}>Descargar constancia</a>
          </Button>
          <Button variant="outline" asChild className="w-full">
            <a href={done.manageUrl}>Administrar o revocar</a>
          </Button>
        </section>
      ) : step === 0 ? (
        <section className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{data.copy.intro}</p>
          <p className="text-sm">Celular: <strong>{data.contact.phone}</strong></p>
          <p className="text-sm">Email: <strong>{data.contact.email || "—"}</strong></p>
          <div className="space-y-2">
            <Label>Nombre y apellido</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={data.identity.fullName || "Como figura en tu DNI"} />
          </div>
          <div className="space-y-2">
            <Label>DNI</Label>
            <Input value={dni} onChange={(e) => setDni(e.target.value)} inputMode="numeric" placeholder={data.identity.dni || "Documento"} />
          </div>
          <div className="space-y-2">
            <Label>CUIL</Label>
            <Input value={cuil} onChange={(e) => setCuil(e.target.value)} inputMode="numeric" placeholder={data.identity.cuil || "CUIL"} />
          </div>
          <Button className="w-full" disabled={busy} onClick={() => void sendOtp()}>Enviar código por WhatsApp</Button>
        </section>
      ) : step === 1 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Código de WhatsApp</h2>
          <p className="text-sm text-muted-foreground">
            Este enlace te llegó por mail. El código de 6 dígitos te llega por WhatsApp
            {whatsappChallenge?.destinationMasked ? ` a ${whatsappChallenge.destinationMasked}` : ""}.
            Cargalo acá para validar el número. Vence en 10 minutos.
          </p>
          <div className="space-y-2">
            <Label htmlFor="wa-otp">Código</Label>
            <Input
              id="wa-otp"
              value={whatsappCode}
              onChange={(e) => setWhatsappCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="6 dígitos"
            />
          </div>
          <Button className="w-full" disabled={busy || whatsappCode.length < 4} onClick={() => void verifyOtp()}>Verificar y continuar</Button>
          <Button variant="outline" className="w-full" disabled={busy} onClick={() => void sendOtp()}>Reenviar código</Button>
        </section>
      ) : (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Aceptá la adhesión</h2>
          <div className="max-h-48 overflow-auto rounded-md border p-3 text-xs leading-relaxed whitespace-pre-wrap">{data.terms.content}</div>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} />
            <span>He leído y acepto adherirme voluntariamente al sistema de notificaciones electrónicas.</span>
          </label>
          <Button className="w-full" disabled={!accepted || busy} onClick={() => void accept()}>ACEPTAR Y ADHERIRME</Button>
        </section>
      )}

      {error && data ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
    </main>
  );
}
