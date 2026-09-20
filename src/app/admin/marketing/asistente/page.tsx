"use client";

import { useEffect } from "react";
import { useAssistantDrawer } from "@/components/admin/marketing/assistant-drawer";
import { MarketingSubnav } from "@/components/admin/marketing/marketing-subnav";
import { Sparkles } from "lucide-react";

export default function AdminMarketingAssistantPage() {
  const { open } = useAssistantDrawer();

  useEffect(() => {
    // Auto-open the drawer when landing on this page
    const timer = setTimeout(open, 100);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <div className="space-y-6">
      <MarketingSubnav />
      <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
        <Sparkles className="h-8 w-8 opacity-40" />
        <p className="text-sm">El asistente IA se abrirá como panel lateral.</p>
        <p className="text-xs">Podés usar <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd> desde cualquier página del CRM.</p>
      </div>
    </div>
  );
}
