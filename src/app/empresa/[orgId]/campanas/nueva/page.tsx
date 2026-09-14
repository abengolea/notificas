"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { listenWhenSignedIn } from "@/lib/listen-when-signed-in";
import { CampaignWizard } from "@/components/empresa/campaign-wizard";
import { EmpresaPage } from "@/components/empresa/empresa-page";

export default function NuevaCampanaPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [plan, setPlan] = useState<string>("starter");

  useEffect(() => {
    return listenWhenSignedIn(
      () =>
        onSnapshot(
          doc(db, "organizations", orgId),
          (s) => {
            if (s.exists()) setPlan(String(s.data()?.plan || "starter"));
          },
          () => undefined,
        ),
    );
  }, [orgId]);

  return (
    <EmpresaPage
      title="Enviar nuevo envío masivo"
      description="Elegí canal, destinatarios (padrón o CSV) y el mensaje."
    >
      <CampaignWizard orgId={orgId} orgPlan={plan} />
    </EmpresaPage>
  );
}
