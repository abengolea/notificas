"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Input } from "./input"
import { Label } from "./label"
import { Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmpresaAutocompleteProps {
  value: string
  onChange: (value: string) => void
  empresas: string[]
  placeholder?: string
  label?: string
  id?: string
  disabled?: boolean
  hint?: string
  className?: string
}

export function EmpresaAutocomplete({
  value,
  onChange,
  empresas,
  placeholder = "Nombre de la organización",
  label,
  id = "empresa-input",
  disabled,
  hint,
  className,
}: EmpresaAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const suggestions = useMemo(() => {
    const term = value.trim().toLowerCase()
    if (!term) return empresas.slice(0, 8)
    return empresas.filter((e) => e.toLowerCase().includes(term)).slice(0, 8)
  }, [value, empresas])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (empresa: string) => {
    onChange(empresa)
    setShowSuggestions(false)
  }

  return (
    <div className={cn("relative", className)}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (empresas.length > 0 && suggestions.length > 0) setShowSuggestions(true)
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setShowSuggestions(false)
        }}
        placeholder={placeholder}
        autoComplete="organization"
        disabled={disabled}
        className={label ? "mt-2" : undefined}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-popover shadow-md"
        >
          {suggestions.map((empresa) => (
            <button
              key={empresa}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(empresa)}
            >
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{empresa}</span>
            </button>
          ))}
        </div>
      )}

      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
