"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { RecipientListManager } from "@/components/empresa/recipient-list-manager";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function EditarListaPage() {
  const { orgId, listId } = useParams<{ orgId: string; listId: string }>();
  return (
    <div className="p-8">
      <Button variant="ghost" asChild className="mb-6 gap-2">
        <Link href={`/empresa/${orgId}/listas`}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </Button>
      <RecipientListManager orgId={orgId} listId={listId} />
    </div>
  );
}
