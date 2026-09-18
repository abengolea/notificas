"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { catalogRowMatchesQuery } from "@/lib/marketing/taxonomy/seed";
import { cn } from "@/lib/utils";

export type CatalogSearchOption = {
  key: string;
  name: string;
  keywords?: readonly string[];
};

export function CatalogSearchSelect({
  id,
  label,
  placeholder,
  searchPlaceholder = "Escribí para filtrar…",
  value,
  values,
  options,
  onChange,
  onValuesChange,
  disabled = false,
  emptyValue = "",
  emptyLabel,
  multiple = false,
}: {
  id?: string;
  label: string;
  placeholder: string;
  searchPlaceholder?: string;
  value?: string;
  values?: string[];
  options: CatalogSearchOption[];
  onChange?: (value: string) => void;
  onValuesChange?: (values: string[]) => void;
  disabled?: boolean;
  emptyValue?: string;
  emptyLabel?: string;
  multiple?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedKeys = multiple ? values || [] : value && value !== emptyValue ? [value] : [];
  const selected = options.filter((row) => selectedKeys.includes(row.key));
  const shown = useMemo(
    () => options.filter((row) => catalogRowMatchesQuery(row, query)),
    [options, query],
  );
  const allShownSelected = shown.length > 0 && shown.every((row) => selectedKeys.includes(row.key));

  const display = (() => {
    if (selected.length === 0) return emptyLabel || placeholder;
    if (selected.length === 1) return selected[0].name;
    if (options.length > 0 && selected.length === options.length) return `Todos (${selected.length})`;
    return `${selected.length} seleccionados`;
  })();

  function chooseOne(next: string) {
    onChange?.(next);
    setOpen(false);
    setQuery("");
  }

  function toggleMany(key: string) {
    const next = selectedKeys.includes(key)
      ? selectedKeys.filter((item) => item !== key)
      : [...selectedKeys, key];
    onValuesChange?.(next);
  }

  function toggleAllShown() {
    if (allShownSelected) {
      const drop = new Set(shown.map((row) => row.key));
      onValuesChange?.(selectedKeys.filter((key) => !drop.has(key)));
      return;
    }
    onValuesChange?.([...new Set([...selectedKeys, ...shown.map((row) => row.key)])]);
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="h-10 w-full justify-between font-normal"
          >
            <span className={cn("truncate", selected.length ? undefined : "text-muted-foreground")}>
              {display}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
          <div className="mt-2 max-h-64 overflow-y-auto">
            {multiple && shown.length > 0 ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={toggleAllShown}
              >
                <span className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                  allShownSelected ? "bg-primary text-primary-foreground" : "opacity-70",
                )}>
                  {allShownSelected ? <Check className="h-3 w-3" /> : null}
                </span>
                {allShownSelected ? "Quitar todos" : "Seleccionar todos"}
              </button>
            ) : null}
            {!multiple && emptyLabel && !query.trim() ? (
              <button
                type="button"
                className="flex w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => chooseOne(emptyValue)}
              >
                {emptyLabel}
              </button>
            ) : null}
            {shown.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">Nada coincide con esa búsqueda.</p>
            ) : (
              shown.map((row) => {
                const checked = selectedKeys.includes(row.key);
                return (
                  <button
                    key={row.key}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
                      checked ? "bg-muted/60" : "",
                    )}
                    onClick={() => (multiple ? toggleMany(row.key) : chooseOne(row.key))}
                  >
                    {multiple ? (
                      <span className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary",
                        checked ? "bg-primary text-primary-foreground" : "opacity-70",
                      )}>
                        {checked ? <Check className="h-3 w-3" /> : null}
                      </span>
                    ) : null}
                    <span className={cn("truncate", !multiple && checked ? "font-medium" : undefined)}>
                      {row.name}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
