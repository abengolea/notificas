import { cn } from "@/lib/utils";
import { artRecipientStatusLabel, artRecipientStatusTone } from "@/lib/art/status-labels";

export function ArtStatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = artRecipientStatusTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[13px] font-medium leading-5",
        tone === "positive" && "bg-primary/12 text-primary",
        tone === "neutral" && "bg-muted text-muted-foreground",
        tone === "caution" && "bg-warning/15 text-warning-foreground",
        tone === "danger" && "bg-destructive/15 text-destructive-foreground",
        className,
      )}
    >
      {artRecipientStatusLabel(status)}
    </span>
  );
}
