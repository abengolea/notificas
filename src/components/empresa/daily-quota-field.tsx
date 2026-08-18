"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TANDA_PRESETS } from "@/lib/campaign-tanda";

type Props = {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  hint?: string;
};

export function DailyQuotaField({ value, onChange, disabled, hint }: Props) {
  const isPreset = (TANDA_PRESETS as readonly number[]).includes(value);

  return (
    <div className="space-y-2">
      <Label className="text-xs">Tope diario de WhatsApp</Label>
      <div className="flex flex-wrap gap-2">
        {TANDA_PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cn(
              "h-9 rounded-md border px-3 text-sm tabular-nums transition-colors",
              value === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent",
              disabled && "opacity-50 pointer-events-none"
            )}
          >
            {n.toLocaleString("es-AR")}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 max-w-xs">
        <Input
          type="number"
          min={1}
          disabled={disabled}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isInteger(n) && n >= 0) onChange(n);
          }}
          aria-label="Tope diario de WhatsApp (número)"
        />
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : (
        <p className="text-xs text-muted-foreground">
          Es el máximo de destinatarios nuevos por día. Cuando Meta suba el cupo del número, cambiá este valor: el lote de hoy no se mueve; rige mañana a las 9:00.
        </p>
      )}
    </div>
  );
}
