import { Badge } from "@/components/ui/badge";
import { MARKETING_COMMERCIAL_STAGE_SEED } from "@/lib/marketing/domain/commercial-stages";
import { cn } from "@/lib/utils";

const STAGE_COLORS: Record<string, string> = {
  nuevo: "bg-secondary text-secondary-foreground",
  para_investigar: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  listo_para_contactar: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  contactado: "bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100",
  seguimiento_pendiente: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  respondio: "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100",
  interesado: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  reunion_agendada: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  demo_realizada: "bg-purple-200 text-purple-900 dark:bg-purple-800 dark:text-purple-100",
  piloto: "bg-violet-200 text-violet-900 dark:bg-violet-800 dark:text-violet-100",
  negociacion: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  cliente: "bg-emerald-600 text-white dark:bg-emerald-700",
  pausado: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  no_interesado: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  perdido: "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200",
};

export function CommercialStageBadge({ stageId }: { stageId?: string | null }) {
  if (!stageId) return null;
  const stage = MARKETING_COMMERCIAL_STAGE_SEED.find((s) => s.id === stageId);
  const label = stage?.name ?? stageId;
  const color = STAGE_COLORS[stageId] ?? "bg-secondary text-secondary-foreground";
  return (
    <Badge className={cn("shrink-0 text-xs font-medium border-0", color)}>
      {label}
    </Badge>
  );
}

export function CommercialStageSelect({
  value,
  onChange,
  className,
  onBlur,
}: {
  value?: string | null;
  onChange: (stageId: string) => void;
  className?: string;
  onBlur?: () => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={cn(
        "h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring",
        className,
      )}
    >
      {MARKETING_COMMERCIAL_STAGE_SEED.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
