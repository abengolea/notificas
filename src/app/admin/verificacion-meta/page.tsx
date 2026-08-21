"use client";

import { Suspense } from "react";
import { MetaVerificationWorkspace } from "@/components/verify/meta-verification-workspace";

export default function AdminVerificacionMetaPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <MetaVerificationWorkspace adminSession showHeading={false} />
    </Suspense>
  );
}
