"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CampaignWizard } from "@/components/empresa/campaign-wizard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NuevaCampanaPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [plan, setPlan] = useState<string>("starter");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "organizations", orgId), (s) => {
      if (s.exists()) setPlan(String(s.data()?.plan || "starter"));
    });
    return () => unsub();
  }, [orgId]);

  return (
    <div className="p-8">
      <Button variant="ghost" asChild className="mb-6 gap-2">
        <Link href={`/empresa/${orgId}/campanas`}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </Button>
      <CampaignWizard orgId={orgId} orgPlan={plan} />
    </div>
  );
}
