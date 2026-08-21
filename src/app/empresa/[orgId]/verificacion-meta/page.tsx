"use client";

import { Suspense } from "react";
import { MetaVerificationWorkspace } from "@/components/verify/meta-verification-workspace";

export default function EmpresaVerificacionMetaPage() {
  return (
    <div className="p-4 sm:p-8">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <MetaVerificationWorkspace />
      </Suspense>
    </div>
  );
}
