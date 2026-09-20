import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketingCompanies } from "@/components/admin/marketing/marketing-companies";

export default function EmpresasPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <MarketingCompanies />
    </Suspense>
  );
}
