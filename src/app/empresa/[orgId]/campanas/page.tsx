"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Campaign } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function CampanasListPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [rows, setRows] = useState<(Campaign & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "campaigns"), where("orgId", "==", orgId), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(
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
      <div className="p-8">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Campañas</h1>
        <Button asChild>
          <Link href={`/empresa/${orgId}/campanas/nueva`}>Nueva campaña</Link>
        </Button>
      </div>
      <ul className="space-y-2">
        {rows.map((c) => (
          <li key={c.id}>
            <Link
              href={`/empresa/${orgId}/campanas/${c.id}`}
              className="block rounded-lg border p-4 hover:bg-muted/40"
            >
              <div className="font-medium">{c.nombre}</div>
              <div className="text-sm text-muted-foreground">
                {c.estado} · {c.recipientCount} dest.
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
