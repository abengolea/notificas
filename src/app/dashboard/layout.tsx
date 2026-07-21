import type { Metadata } from 'next';
import { ColegioPendingBonusApplier } from '@/components/auth/colegio-pending-bonus-applier';
import { EmpresaDashboardRedirect } from '@/components/auth/empresa-dashboard-redirect';
import { MailActivityToasts } from '@/components/dashboard/mail-activity-toasts';
import { NO_INDEX_METADATA } from '@/lib/seo';

export const metadata: Metadata = {
  ...NO_INDEX_METADATA,
  title: 'Dashboard',
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="grid min-h-screen w-full lg:grid-cols-1">
            <ColegioPendingBonusApplier />
            <EmpresaDashboardRedirect />
            <MailActivityToasts />
            <div className="flex flex-col">
                {children}
            </div>
        </div>
    );
}
