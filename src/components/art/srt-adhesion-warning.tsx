"use client";

import {
  ELECTRONIC_NOTIFICATION_WARNING_BODY,
  ELECTRONIC_NOTIFICATION_WARNING_TITLE,
} from "@/lib/art/electronic-notification-copy";

export function SrtAdhesionWarning() {
  return (
    <div
      role="status"
      className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2.5 text-sm"
    >
      <p className="font-medium">{ELECTRONIC_NOTIFICATION_WARNING_TITLE}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {ELECTRONIC_NOTIFICATION_WARNING_BODY}
      </p>
    </div>
  );
}
