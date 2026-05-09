"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Campaign } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function EmpresaOrgDashboardPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [items, setItems] = useState<(Campaign & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "campaigns"),
      where("orgId", "==", orgId),
      orderBy("createdAt", "desc"),
      limit(8)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              orgId: String(x.orgId),
              createdBy: String(x.createdBy),
              nombre: String(x.nombre),
              asunto: String(x.asunto),
              cuerpo: String(x.cuerpo),
              adjuntos: Array.isArray(x.adjuntos) ? x.adjuntos : [],
              recipientListId: x.recipientListId,
              recipientEmails: Array.isArray(x.recipientEmails) ? x.recipientEmails : [],
              recipientData: Array.isArray(x.recipientData) ? x.recipientData : [],
              recipientCount: typeof x.recipientCount === "number" ? x.recipientCount : 0,
              estado: x.estado as Campaign["estado"],
              stats: x.stats || {
                total: 0,
                enviados: 0,
                leidos: 0,
                pendientes: 0,
                errores: 0,
              },
              createdAt: x.createdAt,
              scheduledAt: x.scheduledAt,
              startedAt: x.startedAt,
              completedAt: x.completedAt,
            };
          })
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [orgId]);

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <Skeleton className="h-10 w-48 mb-4" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:space-y-8 sm:p-8 max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resumen</h1>
          <p className="text-muted-foreground text-sm">Campañas recientes</p>
        </div>
        <Button asChild>
          <Link href={`/empresa/${orgId}/campanas/nueva`}>Nueva campaña</Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin campañas</CardTitle>
            <CardDescription>Creá la primera campaña de envío masivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/empresa/${orgId}/campanas/nueva`}>Crear campaña</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <Link key={c.id} href={`/empresa/${orgId}/campanas/${c.id}`}>
              <Card className="hover:border-primary/40 transition-colors">
                <CardHeader className="py-4">
                  <CardTitle className="text-base">{c.nombre}</CardTitle>
                  <CardDescription>{c.asunto}</CardDescription>
                </CardHeader>
                <CardContent className="pb-4 text-sm text-muted-foreground">
                  Estado: {c.estado} — Destinatarios: {c.recipientCount} — Leídos: {c.stats.leidos}/
                  {c.stats.enviados}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
