"use client";

import { useParams } from "next/navigation";
import { AdminCampaignOps } from "@/components/admin/admin-campaign-ops";

export default function AdminCampanaDetallePage() {
  const params = useParams();
  const campaignId = typeof params.campaignId === "string" ? params.campaignId : "";
  if (!campaignId) return null;
  return <AdminCampaignOps campaignId={campaignId} />;
}
