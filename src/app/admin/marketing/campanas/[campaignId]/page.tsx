"use client";

import { useParams } from "next/navigation";
import { MarketingCampaignDetail } from "@/components/admin/marketing/marketing-campaign-detail";

export default function AdminMarketingCampanaPage() {
  const params = useParams();
  const campaignId = typeof params.campaignId === "string" ? params.campaignId : "";
  if (!campaignId) return null;
  return <MarketingCampaignDetail campaignId={campaignId} />;
}
