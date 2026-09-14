"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { listenWhenSignedIn } from "@/lib/listen-when-signed-in";
import { Button } from "@/components/ui/button";
import { EmpresaPage } from "@/components/empresa/empresa-page";

export default function ListasPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [rows, setRows] = useState<{ id: string; nombre: string; count: number }[]>([]);

  useEffect(() => {
    return listenWhenSignedIn(
      () => {
        const q = query(collection(db, "recipient_lists"), where("orgId", "==", orgId), orderBy("updatedAt", "desc"));
        return onSnapshot(
          q,
          (snap) => {
            setRows(
              snap.docs.map((d) => {
                const x = d.data();
                return {
                  id: d.id,
                  nombre: String(x.nombre || ""),
                  count: typeof x.count === "number" ? x.count : 0,
                };
              })
            );
          },
          () => setRows([]),
        );
      },
      () => setRows([]),
    );
  }, [orgId]);

  return (
    <EmpresaPage
      className="max-w-3xl"
      title="Listas de destinatarios"
      description="Listas reutilizables para envíos masivos. El padrón de adhesiones vive en Personas."
      actions={
        <Button size="sm" asChild>
          <Link href={`/empresa/${orgId}/listas/nueva`}>Nueva lista</Link>
        </Button>
      }
    >
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border/80 bg-card px-4 py-10 text-center text-[14px] leading-6 text-muted-foreground">
          No hay listas. Importá un CSV o cargá destinatarios manualmente.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/80 bg-card">
          <ul>
            {rows.map((r) => (
              <li key={r.id} className="border-b border-border/70 last:border-0">
                <Link
                  href={`/empresa/${orgId}/listas/${r.id}`}
                  className="block px-4 py-3 hover:bg-muted/40"
                >
                  <div className="truncate text-[14px] font-medium leading-5">{r.nombre}</div>
                  <div className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
                    <span className="tabular-nums">{r.count}</span> destinatarios
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </EmpresaPage>
  );
}
