
import PlanManagement from "@/components/admin/plan-management";
import { mockPlanes } from "@/lib/mock-data";

export default function PlansPage() {
    return (
        <div className="grid gap-4">
            <PlanManagement planes={mockPlanes} />
        </div>
    );
}
