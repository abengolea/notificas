"use client";

import { Suspense } from "react";
import { ResendVerificationWorkspace } from "@/components/verify/resend-verification-workspace";

export default function EmpresaVerificacionResendPage() {
  return (
    <div className="p-4 sm:p-8">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <ResendVerificationWorkspace />
      </Suspense>
    </div>
  );
}
