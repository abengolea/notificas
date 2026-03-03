"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "./input"
import { Label } from "./label"
import { Contacto } from "@/lib/types"
import { buscarContactos } from "@/lib/contactos"
import { User } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmailAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  onContactSelect?: (contacto: Contacto) => void
  placeholder?: string
  label?: string
  error?: string
  userId: string
  className?: string
}

export function EmailAutocomplete({
  value,
  onChange,
  onBlur,
  onContactSelect,
  placeholder = "destinatario@ejemplo.com",
  label = "Email del Destinatario",
  error,
  userId,
  className
}: EmailAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Contacto[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Buscar sugerencias cuando cambia el valor
  useEffect(() => {
    const searchSuggestions = async () => {
      if (!value || value.length < 2 || !userId) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      setIsLoading(true)
      try {
        const contactos = await buscarContactos(userId, value, 5)
        // Filtrar sugerencias que ya coincidan exactamente con el valor actual
        const filteredContactos = contactos.filter(contacto => 
          contacto.email.toLowerCase() !== value.toLowerCase()
        )
        setSuggestions(filteredContactos)
        setShowSuggestions(filteredContactos.length > 0)
      } catch (error) {
        console.error('Error al buscar contactos:', error)
        setSuggestions([])
        setShowSuggestions(false)
      } finally {
        setIsLoading(false)
      }
    }

    const timeoutId = setTimeout(searchSuggestions, 300) // Debounce
    return () => clearTimeout(timeoutId)
  }, [value, userId])

  // Cerrar sugerencias al hacer clic fuera
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

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSuggestionClick = (contacto: Contacto) => {
    // Establecer el valor del email
    onChange(contacto.email)
    // Notificar contacto seleccionado (ej. para autocompletar teléfono)
    onContactSelect?.(contacto)
    
    // Cerrar las sugerencias inmediatamente
    setShowSuggestions(false)
    setSuggestions([])
    
    // Disparar el evento de blur para activar la validación
    setTimeout(() => {
      inputRef.current?.blur()
      inputRef.current?.focus()
    }, 100)
  }

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div className="relative">
      {label && <Label htmlFor="email-input">{label}</Label>}
      <Input
        ref={inputRef}
        id="email-input"
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "pr-8",
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
        autoComplete="off"
      />
      
      {/* Indicador de carga */}
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Lista de sugerencias */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {suggestions.map((contacto) => (
            <div
              key={contacto.id}
              className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              onClick={() => handleSuggestionClick(contacto)}
            >
              <User className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {contacto.email}
                </div>
                {contacto.nombre && contacto.nombre !== contacto.email.split('@')[0] && (
                  <div className="text-xs text-gray-500 truncate">
                    {contacto.nombre}
                  </div>
                )}
                {contacto.telefono && (
                  <div className="text-xs text-emerald-600 truncate">
                    📱 {contacto.telefono}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-400 ml-2">
                {contacto.vecesUsado}x
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mensaje de error */}
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}
    </div>
  )
}
