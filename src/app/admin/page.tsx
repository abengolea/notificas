
import StatsCards from "@/components/admin/stats-cards";
import { mockAdminStats } from "@/lib/mock-data";

export default function AdminPage() {
    return (
        <>
            <StatsCards stats={mockAdminStats} />
            {/* Future components for the overview page can go here */}
            {/* For example, an activity chart */}
        </>
    );
}
