import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketingFollowup } from "@/components/admin/marketing/marketing-followup";

export default function SeguimientoPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <MarketingFollowup />
    </Suspense>
  );
}
