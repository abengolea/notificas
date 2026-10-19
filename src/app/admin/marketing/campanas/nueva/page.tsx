import { Suspense } from "react";
import { MarketingCampaignForm } from "@/components/admin/marketing/marketing-campaign-form";

export default function AdminMarketingCampanaNuevaPage() {
  return (
    <Suspense>
      <MarketingCampaignForm />
    </Suspense>
  );
}
