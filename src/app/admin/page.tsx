
import StatsCards from "@/components/admin/stats-cards";
import { mockAdminStats } from "@/lib/mock-data";
import OverviewChart from "@/components/admin/overview-chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AdminPage() {
    return (
        <div className="space-y-4">
            <StatsCards stats={mockAdminStats} />
            <Card>
                <CardHeader>
                    <CardTitle>Visión General</CardTitle>
                    <CardDescription>
                        Actividad de usuarios e ingresos durante el último año.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <OverviewChart />
                </CardContent>
            </Card>
        </div>
    );
}
