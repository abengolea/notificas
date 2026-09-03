"use client";

import { Suspense } from "react";
import { ResendVerificationWorkspace } from "@/components/verify/resend-verification-workspace";

export default function AdminVerificacionResendPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <ResendVerificationWorkspace adminSession showHeading={false} />
    </Suspense>
  );
}
