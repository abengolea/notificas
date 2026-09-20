import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketingReplies } from "@/components/admin/marketing/marketing-replies";

export default function RespuestasPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <MarketingReplies />
    </Suspense>
  );
}
