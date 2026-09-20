import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketingOpportunities } from "@/components/admin/marketing/marketing-opportunities";

export default function OportunidadesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <MarketingOpportunities />
    </Suspense>
  );
}
