"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { User } from "@/lib/types"
import { guardarContacto } from "@/lib/contactos"
import { UserPlus, Loader2 } from "lucide-react"

const contactoSchema = z.object({
  nombre: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
  email: z.string().email({ message: "Dirección de correo electrónico inválida." }),
  cuit: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true; // CUIT es opcional
    // Validar formato de CUIT: XX-XXXXXXXX-X
    const cuitRegex = /^\d{2}-\d{8}-\d{1}$/;
    return cuitRegex.test(val);
  }, { message: "El CUIT debe tener el formato XX-XXXXXXXX-X" }),
  telefono: z.string().optional().refine((v) => !v || /^[\d\s\+\-\(\)]{8,20}$/.test(v), "Número inválido (ej: +54 11 1234-5678)")
})

type ContactoFormValues = z.infer<typeof contactoSchema>

interface NuevoContactoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User
  onContactoAgregado?: () => void
}

export function NuevoContactoDialog({ 
  open, 
  onOpenChange, 
  user, 
  onContactoAgregado 
}: NuevoContactoDialogProps) {
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()
  
  const form = useForm<ContactoFormValues>({
    resolver: zodResolver(contactoSchema),
    defaultValues: {
      nombre: "",
      email: "",
      cuit: "",
      telefono: "",
    },
  })

  const onSubmit = async (data: ContactoFormValues) => {
    if (!user.uid) return

    setIsSaving(true)
    try {
      await guardarContacto(
        user.uid,
        data.email,
        data.nombre,
        data.cuit || undefined,
        data.telefono?.trim() || undefined
      )

      toast({
        title: "Contacto Agregado",
        description: `${data.nombre} ha sido agregado a tus contactos.`,
        variant: "default",
      })

      form.reset()
      onOpenChange(false)
      onContactoAgregado?.()
    } catch (error: any) {
      console.error('Error al agregar contacto:', error)
      toast({
        title: "Error al agregar contacto",
        description: error?.message || 'No se pudo agregar el contacto',
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    if (!isSaving) {
      form.reset()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Nuevo Contacto
          </DialogTitle>
          <DialogDescription>
            Agrega un nuevo contacto a tu lista. CUIT y teléfono (para WhatsApp) son opcionales.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              {...form.register("nombre")}
              placeholder="Nombre del contacto"
              disabled={isSaving}
            />
            {form.formState.errors.nombre && (
              <p className="text-sm text-destructive">
                {form.formState.errors.nombre.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              {...form.register("email")}
              placeholder="contacto@ejemplo.com"
              disabled={isSaving}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cuit">CUIT (Opcional)</Label>
            <Input
              id="cuit"
              {...form.register("cuit")}
              placeholder="XX-XXXXXXXX-X"
              disabled={isSaving}
            />
            {form.formState.errors.cuit && (
              <p className="text-sm text-destructive">
                {form.formState.errors.cuit.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Formato: XX-XXXXXXXX-X (ej: 20-12345678-9)
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="telefono">Teléfono WhatsApp (Opcional)</Label>
            <Input
              id="telefono"
              type="tel"
              {...form.register("telefono")}
              placeholder="+54 11 1234-5678"
              disabled={isSaving}
            />
            {form.formState.errors.telefono && (
              <p className="text-sm text-destructive">
                {form.formState.errors.telefono.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Si agregas teléfono, podrás enviar WhatsApp además del correo.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Agregar Contacto
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
