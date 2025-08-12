import { UserNav } from '@/components/dashboard/user-nav';
import { Logo } from '@/components/logo';
import Link from 'next/link';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="grid min-h-screen w-full lg:grid-cols-1">
            <div className="flex flex-col">
                {children}
            </div>
        </div>
    );
}
