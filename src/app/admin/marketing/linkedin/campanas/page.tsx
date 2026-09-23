import { Suspense } from "react";
import { LinkedInCampaigns } from "@/components/admin/marketing/linkedin-campaigns";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminMarketingLinkedInCampaignsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <LinkedInCampaigns />
    </Suspense>
  );
}
