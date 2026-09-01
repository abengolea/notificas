"use client";

import { useParams } from "next/navigation";
import { MailMessageDetail } from "@/components/dashboard/mail-message-detail";

export default function EmpresaEnvioDetailPage() {
  const { orgId, id } = useParams<{ orgId: string; id: string }>();
  return (
    <MailMessageDetail
      messageId={id}
      backHref={`/empresa/${orgId}/envios`}
      showAppChrome={false}
    />
  );
}
