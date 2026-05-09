"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlanManagement from "@/components/admin/plan-management";
import ColegioDiscountAdminCard from "@/components/admin/colegio-discount-admin";

export function AdminPlansTabs() {
  return (
    <Tabs defaultValue="planes" className="w-full">
      <TabsList className="w-full max-w-md justify-start sm:w-auto">
        <TabsTrigger value="planes">Planes y precios</TabsTrigger>
        <TabsTrigger value="colegios">Colegios de abogados</TabsTrigger>
      </TabsList>
      <TabsContent value="planes" className="mt-6">
        <PlanManagement />
      </TabsContent>
      <TabsContent value="colegios" className="mt-6">
        <ColegioDiscountAdminCard />
      </TabsContent>
    </Tabs>
  );
}
