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

const STEPS = ["Datos", "Email", "Identidad", "Adhesión", "Listo"];

export default function AdherirPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [data, setData] = useState<InvitePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [dni, setDni] = useState("");
  const [cuil, setCuil] = useState("");
  const [fullName, setFullName] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
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

  const progress = useMemo(() => Math.round(((done ? 4 : step) / 4) * 100), [step, done]);

  async function sendOtp() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/art/public/invite/${token}/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "email", dni, cuil, fullName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error === "identity_mismatch" ? "Los datos no coinciden." : "No pudimos enviar el código.");
      setChallengeId(json.challengeId);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/art/public/invite/${token}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error === "invalid" ? "Código incorrecto." :
          json.error === "expired" ? "El código venció." :
          json.error === "max_attempts" ? "Demasiados intentos." :
          "No se pudo verificar."
        );
      }
      const idRes = await fetch(`/api/art/public/invite/${token}/identity`, { method: "POST" });
      const idJson = await idRes.json().catch(() => ({}));
      if (idJson.identityStatus === "pending") {
        setStep(3);
        setError("Tu identidad quedó pendiente de un proveedor externo. La ART puede prevalidarla o se conectará RENAPER/Didit más adelante.");
        return;
      }
      setStep(3);
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
        body: JSON.stringify({ accepted: true, otpChallengeId: challengeId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error("No se pudo registrar la adhesión. Revisá los pasos anteriores.");
      setDone({ adhesionId: json.adhesionId, manageUrl: json.manageUrl, manageToken: json.manageToken });
      setStep(4);
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
            <div className={cn("h-1 rounded-full", i <= (done ? 4 : step) ? "bg-primary" : "bg-muted")} />
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
          <Button className="w-full" disabled={busy} onClick={() => void sendOtp()}>Continuar</Button>
        </section>
      ) : step === 1 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Verificá tu email</h2>
          <p className="text-sm text-muted-foreground">Te enviamos un código al email informado. El celular se valida por separado cuando exista OTP por WhatsApp.</p>
          <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="Código de 6 dígitos" />
          <Button className="w-full" disabled={busy || code.length < 4} onClick={() => void verifyOtp()}>Verificar</Button>
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
