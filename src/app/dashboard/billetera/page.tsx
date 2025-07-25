import { UserNav } from '@/components/dashboard/user-nav';
import WalletClient from '@/components/dashboard/wallet-client';
import { Logo } from '@/components/logo';
import { mockTransactions, mockUser, mockPlanes } from '@/lib/mock-data';
import Link from 'next/link';

export default function BilleteraPage() {
    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
            <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-6">
                <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                    <Logo className="h-8 w-auto" />
                    <span className="font-bold">Notificas</span>
                </Link>
                <div className="flex w-full flex-1 items-center justify-end">
                    <UserNav user={mockUser} />
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6">
                <WalletClient 
                    user={mockUser} 
                    transactions={mockTransactions}
                    planes={mockPlanes}
                />
            </main>
        </div>
    );
}
