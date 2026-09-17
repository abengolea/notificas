import { STAGE_LABEL, type MarketingStage } from "@/lib/marketing/stages";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CLASS: Record<string, string> = {
  new: "bg-secondary text-secondary-foreground hover:bg-secondary",
  queued: "bg-muted text-foreground hover:bg-muted",
  sent: "border-transparent bg-[#3a7d82] text-white hover:bg-[#3a7d82]",
  delivered: "border-transparent bg-[#4a8f7a] text-white hover:bg-[#4a8f7a]",
  opened: "border-transparent bg-[#2f5d73] text-white hover:bg-[#2f5d73]",
  clicked: "border-transparent bg-[#1e3a4c] text-white hover:bg-[#1e3a4c]",
  replied: "border-transparent bg-emerald-700 text-white hover:bg-emerald-700",
  bounced: "bg-destructive text-destructive-foreground hover:bg-destructive",
  unsubscribed: "bg-muted text-muted-foreground hover:bg-muted",
  not_interested: "bg-muted text-muted-foreground hover:bg-muted",
};

const EXTRA_LABEL: Record<string, string> = {
  delivered: "Recibido",
};

export function StageBadge({ stage }: { stage: string }) {
  const key = stage as MarketingStage;
  const label = EXTRA_LABEL[stage] || STAGE_LABEL[key] || stage;
  return (
    <Badge variant="secondary" className={cn("font-medium tabular-nums", CLASS[stage] || CLASS[key] || "")}>
      {label}
    </Badge>
  );
}
