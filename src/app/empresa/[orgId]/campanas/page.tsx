"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { listenWhenSignedIn } from "@/lib/listen-when-signed-in";
import type { Campaign } from "@/lib/types";
import { isAdminManagedCampaign, isUnsentCampaign } from "@/lib/campaign-edit";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmpresaEnviosSaldoLiveBanner } from "@/components/empresa/empresa-envios-saldo-banner";
import { EmpresaPage } from "@/components/empresa/empresa-page";

function campaignEstadoLabel(estado: Campaign["estado"]): string {
  switch (estado) {
    case "borrador":
      return "Borrador";
    case "enviando":
      return "Enviando";
    case "completada":
      return "Completada";
    case "pausada":
      return "Pausada";
    case "cancelada":
      return "Cancelada";
    default:
      return estado;
  }
}

export default function CampanasListPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [rows, setRows] = useState<(Campaign & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return listenWhenSignedIn(
      () => {
        const q = query(collection(db, "campaigns"), where("orgId", "==", orgId), orderBy("createdAt", "desc"));
        return onSnapshot(
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
              managedByAdmin: x.managedByAdmin === true,
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
      },
      () => {
        setRows([]);
        setLoading(false);
      },
    );
  }, [orgId]);

  if (loading) {
    return (
      <div className="space-y-5 p-5 lg:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <EmpresaPage
      title="Envíos masivos"
      description="Armá un envío a muchas personas. Podés usar el padrón de adhesiones o un CSV."
      actions={
        <Button size="sm" asChild>
          <Link href={`/empresa/${orgId}/campanas/nueva`}>Enviar nuevo envío masivo</Link>
        </Button>
      }
    >
      <EmpresaEnviosSaldoLiveBanner />
      <div className="overflow-hidden rounded-lg border border-border/80 bg-card">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[14px] leading-6 text-muted-foreground">
            Todavía no hay envíos masivos.
          </p>
        ) : (
          <ul>
            {rows.map((c) => (
              <li key={c.id} className="border-b border-border/70 last:border-0">
                <Link
                  href={`/empresa/${orgId}/campanas/${c.id}`}
                  className="block px-4 py-3 hover:bg-muted/40"
                >
                  <div className="truncate text-[14px] font-medium leading-5 text-foreground">{c.nombre}</div>
                  <div className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
                    {campaignEstadoLabel(c.estado)}
                    <span className="px-1.5 text-border">·</span>
                    <span className="tabular-nums">{c.recipientCount}</span> dest.
                    {isAdminManagedCampaign(c)
                      ? " · solo consulta"
                      : isUnsentCampaign(c)
                        ? " · se puede editar"
                        : ""}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </EmpresaPage>
  );
}
