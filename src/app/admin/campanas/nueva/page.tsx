"use client";

import Link from "next/link";
import { CampaignWizard } from "@/components/empresa/campaign-wizard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function AdminNuevaCampanaPage() {
  return (
    <div>
      <Button variant="ghost" asChild className="mb-6 gap-2">
        <Link href="/admin/campanas">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </Button>
      <CampaignWizard mode="admin" />
    </div>
  );
}
