
"use client"

import { mockAdminStats, mockAdminUsers, mockPlanes } from '@/lib/mock-data'
import StatsCards from './stats-cards'
import UserManagement from './user-management'
import PlanManagement from './plan-management'

// This component is not strictly needed anymore as its children are now on separate pages.
// However, we can keep it if we want a single component to aggregate all admin parts for a different view.
// For now, it's unused.
export default function AdminDashboard() {
  return (
    <>
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
    </>
  )
}
