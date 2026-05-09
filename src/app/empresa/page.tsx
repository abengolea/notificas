import { Suspense } from "react";
import { OrgSelector } from "@/components/empresa/org-selector";
import { EmpresaModuloAviso } from "@/components/empresa/empresa-modulo-aviso";

export default function EmpresaHomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <EmpresaModuloAviso />
      </Suspense>
      <OrgSelector />
    </div>
  );
}
