"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ListasPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [rows, setRows] = useState<{ id: string; nombre: string; count: number }[]>([]);

  useEffect(() => {
    const q = query(collection(db, "recipient_lists"), where("orgId", "==", orgId), orderBy("updatedAt", "desc"));
    return onSnapshot(q, (snap) => {
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
    });
  }, [orgId]);

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Listas de destinatarios</h1>
        <Button asChild>
          <Link href={`/empresa/${orgId}/listas/nueva`}>Nueva lista</Link>
        </Button>
      </div>
      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No hay listas</CardTitle>
            <CardDescription>Importá un CSV o cargá destinatarios manualmente.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/empresa/${orgId}/listas/${r.id}`}
                className="block rounded-lg border p-4 hover:bg-muted/40"
              >
                <div className="font-medium">{r.nombre}</div>
                <div className="text-sm text-muted-foreground">{r.count} destinatarios</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
