import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketingTasks } from "@/components/admin/marketing/marketing-tasks";

export default function TareasPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <MarketingTasks />
    </Suspense>
  );
}
