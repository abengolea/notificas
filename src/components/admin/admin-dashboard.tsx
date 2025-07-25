"use client"

import { mockAdminStats, mockAdminUsers, mockPlanes } from '@/lib/mock-data'
import StatsCards from './stats-cards'
import UserManagement from './user-management'
import PlanManagement from './plan-management'
import { MainNav } from './main-nav'
import { UserNav } from '@/components/dashboard/user-nav'
import { mockUser } from '@/lib/mock-data'
import { Search } from 'lucide-react'
import { Input } from '../ui/input'

export default function AdminDashboard() {
  return (
    <div className="flex-col md:flex">
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          <MainNav className="mx-6" />
          <div className="ml-auto flex items-center space-x-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Buscar usuarios, planes..."
                    className="pl-9"
                />
            </div>
            <UserNav user={mockUser} />
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Panel de Administración</h2>
        </div>

        <StatsCards stats={mockAdminStats} />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <div className="col-span-4">
                <UserManagement users={mockAdminUsers} />
            </div>
            <div className="col-span-3">
                <PlanManagement planes={mockPlanes} />
            </div>
        </div>
      </div>
    </div>
  )
}
