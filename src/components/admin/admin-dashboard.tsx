
"use client"

import UserManagement from './user-management'
import PlanManagement from './plan-management'
import AdminOverview from './admin-overview'

// Componente legado no usado en rutas actuales; delega al resumen con datos reales.
export default function AdminDashboard() {
  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Panel de Administración</h2>
      </div>

      <AdminOverview />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <div className="col-span-4">
              <UserManagement />
          </div>
          <div className="col-span-3">
              <PlanManagement />
          </div>
      </div>
    </>
  )
}
