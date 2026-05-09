"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import type { Organization } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2 } from "lucide-react";

function mapOrg(id: string, data: Record<string, unknown>): Organization {
  return {
    id,
    nombre: String(data.nombre ?? ""),
    cuit: String(data.cuit ?? ""),
    tipo: data.tipo as Organization["tipo"],
    adminUserId: String(data.adminUserId ?? ""),
    members: Array.isArray(data.members) ? (data.members as string[]) : [],
    plan: (data.plan as Organization["plan"]) || "starter",
    logoUrl: data.logoUrl as string | undefined,
    createdAt: data.createdAt,
  };
}

export function OrgSelector() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setOrgs([]);
      setLoadError(null);
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/organizations", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json().catch(() => ({}))) as { organizations?: unknown; error?: string };
        if (!res.ok) {
          if (!cancelled) {
            setLoadError(typeof data.error === "string" ? data.error : "No se pudieron cargar las organizaciones");
            setOrgs([]);
          }
          return;
        }
        const raw = Array.isArray(data.organizations) ? data.organizations : [];
        const list: Organization[] = [];
        for (const row of raw) {
          if (!row || typeof row !== "object" || !("id" in row)) continue;
          const r = row as { id: string } & Record<string, unknown>;
          list.push(mapOrg(r.id, r));
        }
        if (!cancelled) setOrgs(list);
      } catch {
        if (!cancelled) {
          setLoadError("Error de red al cargar organizaciones");
          setOrgs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, number> = {};
      for (const o of orgs) {
        const snap = await getDocs(query(collection(db, "campaigns"), where("orgId", "==", o.id)));
        if (cancelled) return;
        next[o.id] = snap.size;
      }
      if (!cancelled) setCounts(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgs]);

  const sorted = useMemo(() => [...orgs].sort((a, b) => a.nombre.localeCompare(b.nombre)), [orgs]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-7 w-7" />
            Empresas
          </h1>
          <p className="text-muted-foreground mt-1">
            Notificaciones masivas fehacientes por destinatario, certificadas en Polygon.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/empresa/nueva">¿Cómo dar de alta una org.?</Link>
        </Button>
      </div>

      {loadError ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle>No se pudo cargar el listado</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Si el problema continúa, revisá que las credenciales del servidor (Firebase Admin) estén configuradas.</p>
          </CardContent>
        </Card>
      ) : sorted.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin organizaciones</CardTitle>
            <CardDescription>
              Si tu empresa ya fue dada de alta, pedí al administrador que verifique tu usuario (email de la cuenta).
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p className="mb-3">
              El equipo Notificas da de alta tu organización desde el panel admin. Cuando estés asignado, aparecerá
              aquí.
            </p>
            {process.env.NODE_ENV === "development" ? (
              <p className="mb-3 text-xs rounded-md bg-muted/50 p-2">
                En local, la org. de prueba está ligada al usuario{" "}
                <span className="font-mono text-foreground">demo.empresa@notificas.local</span> (script{" "}
                <span className="font-mono">npm run seed:demo-empresa</span>). Si entrás con otra cuenta, no verás esa
                organización.
              </p>
            ) : null}
            <Button variant="outline" asChild>
              <Link href="/empresa/nueva">Más información</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((o) => (
            <Link key={o.id} href={`/empresa/${o.id}/dashboard`}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader>
                  <CardTitle className="text-lg">{o.nombre}</CardTitle>
                  <CardDescription>{o.cuit}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <div>Campañas: {counts[o.id] ?? "…"}</div>
                  <div className="capitalize">Plan: {o.plan}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
