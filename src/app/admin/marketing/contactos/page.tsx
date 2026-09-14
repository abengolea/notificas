import { Suspense } from "react";
import { MarketingContacts } from "@/components/admin/marketing/marketing-contacts";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminMarketingContactosPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <MarketingContacts />
    </Suspense>
  );
}
