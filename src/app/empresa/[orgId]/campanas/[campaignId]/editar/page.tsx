"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { listenWhenSignedIn } from "@/lib/listen-when-signed-in";
import { CampaignWizard } from "@/components/empresa/campaign-wizard";
import { EmpresaPage } from "@/components/empresa/empresa-page";

export default function EditarCampanaPage() {
  const { orgId, campaignId } = useParams<{ orgId: string; campaignId: string }>();
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
      title="Editar envío masivo"
      description="Los cambios se guardan sobre este borrador. Si el envío masivo ya se envió, no se puede modificar."
    >
      <CampaignWizard orgId={orgId} orgPlan={plan} campaignId={campaignId} />
    </EmpresaPage>
  );
}
