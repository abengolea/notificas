"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const CHANNELS = [
  { href: "/admin/marketing/campanas", id: "email", label: "Email" },
  { href: "/admin/marketing/linkedin/campanas", id: "linkedin", label: "LinkedIn" },
] as const;

export function MarketingCampaignChannelTabs({ channel }: { channel: "email" | "linkedin" }) {
  return (
    <div className="inline-flex rounded-md border bg-muted/40 p-1" role="tablist" aria-label="Canal de campañas">
      {CHANNELS.map((item) => {
        const selected = item.id === channel;
        return (
          <Link
            key={item.id}
            href={item.href}
            role="tab"
            aria-selected={selected}
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
