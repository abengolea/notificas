"use client";

import { Suspense } from "react";
import { ResendVerificationWorkspace } from "@/components/verify/resend-verification-workspace";

export default function EmpresaVerificacionResendPage() {
  return (
    <div className="p-5 lg:p-8">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <ResendVerificationWorkspace />
      </Suspense>
    </div>
  );
}
