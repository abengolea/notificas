"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { MailMessageDetail } from "@/components/dashboard/mail-message-detail";

function MessageContent() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : null;

  return <MailMessageDetail messageId={id} backHref="/dashboard" showAppChrome />;
}

export default function MessageDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Cargando mensaje…</p>
        </div>
      }
    >
      <MessageContent />
    </Suspense>
  );
}
