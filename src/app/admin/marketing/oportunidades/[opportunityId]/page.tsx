import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketingOpportunityDetail } from "@/components/admin/marketing/marketing-opportunity-detail";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <MarketingOpportunityDetail opportunityId={opportunityId} />
    </Suspense>
  );
}
