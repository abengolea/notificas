"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CampaignWizard } from "@/components/empresa/campaign-wizard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function AdminEditarCampanaPage() {
  const params = useParams();
  const campaignId = typeof params.campaignId === "string" ? params.campaignId : "";
  if (!campaignId) return null;

  return (
    <div>
      <Button variant="ghost" asChild className="mb-6 gap-2">
        <Link href={`/admin/campanas/${campaignId}`}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </Button>
      <CampaignWizard mode="admin" campaignId={campaignId} />
    </div>
  );
}
