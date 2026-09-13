"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function ManageAdhesionPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<{ art: string; status: string; phone?: string; email?: string; activatedAt?: string | null; adhesionId?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/art/public/manage/${token}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError("No encontramos esta adhesión.");
      else setData(json);
    })();
  }, [token]);

  async function revoke() {
    setBusy(true);
    try {
      const res = await fetch(`/api/art/public/manage/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, reason }),
      });
      if (!res.ok) throw new Error("No se pudo revocar");
      setData((d) => (d ? { ...d, status: "revoked" } : d));
      setConfirm(false);
    } catch {
      setError("No se pudo revocar. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <main className="grid min-h-dvh place-items-center px-5 text-center">{error}</main>;
  if (!data) return <main className="grid min-h-dvh place-items-center">Cargando…</main>;

  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-5 px-5 py-10">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Notificaciones electrónicas</p>
      <h1 className="text-2xl font-semibold">{data.art}</h1>
      <p>Estado: <strong>{data.status}</strong></p>
      <p className="text-sm text-muted-foreground">Celular {data.phone} · Email {data.email || "—"}</p>
      {data.activatedAt ? <p className="text-sm">Adhesión: {new Date(data.activatedAt).toLocaleString("es-AR")}</p> : null}
      {data.adhesionId ? (
        <Button variant="outline" asChild className="w-full">
          <a href={`/api/art/public/evidence/${token}`}>Descargar constancia</a>
        </Button>
      ) : null}
      {data.status !== "revoked" ? (
        confirm ? (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm">¿Confirmás la revocación? Después las notificaciones electrónicas SRT no se enviarán por este canal.</p>
            <Textarea placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button variant="destructive" className="w-full" disabled={busy} onClick={() => void revoke()}>Confirmar revocación</Button>
            <Button variant="ghost" className="w-full" onClick={() => setConfirm(false)}>Cancelar</Button>
          </div>
        ) : (
          <Button variant="destructive" className="w-full" onClick={() => setConfirm(true)}>REVOCAR ADHESIÓN</Button>
        )
      ) : (
        <p className="text-sm text-muted-foreground">Adhesión revocada. Se requiere canal convencional.</p>
      )}
    </main>
  );
}
