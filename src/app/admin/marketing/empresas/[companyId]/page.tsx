import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketingCompanyDetail } from "@/components/admin/marketing/marketing-company-detail";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <MarketingCompanyDetail companyId={companyId} />
    </Suspense>
  );
}
