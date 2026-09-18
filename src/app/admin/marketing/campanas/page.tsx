import { Suspense } from "react";
import { MarketingCampaigns } from "@/components/admin/marketing/marketing-campaigns";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminMarketingCampanasPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <MarketingCampaigns />
    </Suspense>
  );
}
