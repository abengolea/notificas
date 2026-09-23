"use client";

import { useParams } from "next/navigation";
import { LinkedInCampaignDetail } from "@/components/admin/marketing/linkedin-campaign-detail";

export default function AdminMarketingLinkedInCampaignDetailPage() {
  const params = useParams();
  const campaignId = typeof params.campaignId === "string" ? params.campaignId : "";
  if (!campaignId) return null;
  return <LinkedInCampaignDetail campaignId={campaignId} />;
}
