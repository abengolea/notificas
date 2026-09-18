"use client";

import { Button } from "@/components/ui/button";

export function MarketingCampaignActions({
  archived,
  failedCount,
  canRetry,
  busy,
  onCopy,
  onRetry,
  onArchive,
}: {
  archived: boolean;
  failedCount: number;
  canRetry: boolean;
  busy: boolean;
  onCopy: () => void;
  onRetry: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" disabled={busy} onClick={onCopy}>
        Copiar campaña
      </Button>
      <Button type="button" variant="outline" disabled={busy || !canRetry} onClick={onRetry}>
        Reenviar fallidos{failedCount > 0 ? ` (${failedCount})` : ""}
      </Button>
      <Button type="button" variant="outline" disabled={busy} onClick={onArchive}>
        {archived ? "Restaurar" : "Archivar"}
      </Button>
    </div>
  );
}
