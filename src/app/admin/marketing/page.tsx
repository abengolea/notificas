import { Suspense } from "react";
import { MarketingDashboard, MarketingDashboardFallback } from "@/components/admin/marketing/marketing-dashboard";

export default function AdminMarketingPage() {
  return (
    <Suspense fallback={<MarketingDashboardFallback />}>
      <MarketingDashboard />
    </Suspense>
  );
}
