"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type OrgRow = { id: string; nombre?: string; adminUserEmail?: string };
type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  environment: string;
  status: string;
  createdAt: string | null;
  lastUsedAt: string | null;
};

export default function AdminApiKeysPage() {
  const { toast } = useToast();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [orgId, setOrgId] = useState("");
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("Producción");
  const [environment, setEnvironment] = useState<"live" | "test">("live");
  const [revealed, setRevealed] = useState<string | null>(null);

  async function loadOrgs() {
    const res = await fetch("/api/admin/organizations", { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error");
    setOrgs(data.organizations || []);
  }

  async function loadKeys(id: string) {
    if (!id) {
      setKeys([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/api-keys?orgId=${encodeURIComponent(id)}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setKeys(data.keys || []);
    } catch (e: unknown) {
      toast({ title: "No se pudieron cargar las claves", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrgs().catch((e) =>
      toast({ title: "Error al listar empresas", description: e instanceof Error ? e.message : "", variant: "destructive" })
    );
  }, []);

  useEffect(() => {
    void loadKeys(orgId);
  }, [orgId]);

  async function createKey() {
    if (!orgId) {
      toast({ title: "Elegí una empresa", variant: "destructive" });
      return;
    }
    setSaving(true);
    setRevealed(null);
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, name, environment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setRevealed(data.secret);
      toast({ title: "API Key creada", description: "Copiá el secret ahora. No se vuelve a mostrar." });
      await loadKeys(orgId);
    } catch (e: unknown) {
      toast({ title: "No se pudo crear la clave", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function revoke(keyId: string) {
    if (!confirm("¿Revocar esta API Key? Las integraciones dejarán de autenticarse.")) return;
    const res = await fetch(`/api/admin/api-keys?keyId=${encodeURIComponent(keyId)}&orgId=${encodeURIComponent(orgId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "No se pudo revocar", description: data.error || "", variant: "destructive" });
      return;
    }
    toast({ title: "Clave revocada" });
    await loadKeys(orgId);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            API Keys de empresas
          </CardTitle>
          <CardDescription>
            Generá o revocá claves para la API pública v1. El secret completo se muestra una sola vez.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar organización" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nombre || o.id} {o.adminUserEmail ? `(${o.adminUserEmail})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select value={environment} onValueChange={(v) => setEnvironment(v as "live" | "test")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">live (ntf_live_)</SelectItem>
                  <SelectItem value="test">test / sandbox (ntf_test_)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={createKey} disabled={saving || !orgId}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Generar clave
              </Button>
            </div>
          </div>
          {revealed ? (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium mb-1">Secret (copiá ahora)</p>
              <code className="break-all">{revealed}</code>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Claves</CardTitle>
            <CardDescription>Nunca se guarda el secret en texto plano. Solo el prefijo y un hash.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadKeys(orgId)} disabled={loading || !orgId}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Prefijo</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">Cargando…</TableCell>
                  </TableRow>
                ) : keys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      {orgId ? "No hay claves para esta empresa." : "Elegí una empresa."}
                    </TableCell>
                  </TableRow>
                ) : (
                  keys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell>{k.name}</TableCell>
                      <TableCell className="font-mono text-xs">{k.prefix}…</TableCell>
                      <TableCell>{k.environment}</TableCell>
                      <TableCell>{k.status}</TableCell>
                      <TableCell className="text-right">
                        {k.status === "active" ? (
                          <Button variant="destructive" size="sm" onClick={() => revoke(k.id)}>
                            Revocar
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
