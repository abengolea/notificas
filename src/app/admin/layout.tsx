
"use client"

import { usePathname } from 'next/navigation'
import { MainNav } from '@/components/admin/main-nav'
import { UserNav } from '@/components/dashboard/user-nav'
import { mockUser } from '@/lib/mock-data'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/logo'
import Link from 'next/link'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname()

    const getPageTitle = () => {
        if (pathname === '/admin') return 'Resumen'
        if (pathname.startsWith('/admin/users')) return 'Gestión de Usuarios'
        if (pathname.startsWith('/admin/plans')) return 'Gestión de Planes y Precios'
        if (pathname.startsWith('/admin/settings')) return 'Configuración'
        return 'Panel de Administración'
    }

    return (
        <div className="flex-col md:flex min-h-screen bg-muted/30">
             <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4">
                <Link href="/admin" className="hidden items-center gap-2 font-semibold md:flex">
                    <Logo className="h-8 w-auto" />
                    <span className="font-bold">Notificas Admin</span>
                </Link>
                <MainNav className="hidden md:flex" />
                <div className="ml-auto flex items-center space-x-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Buscar..."
                            className="pl-9"
                        />
                    </div>
                    <UserNav user={mockUser} />
                </div>
            </header>
            <div className="flex-1 space-y-4 p-8 pt-6">
                 <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">{getPageTitle()}</h2>
                </div>
                {children}
            </div>
        </div>
    );
}
