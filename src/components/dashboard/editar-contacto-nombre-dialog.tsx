"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { actualizarContacto } from "@/lib/contactos";
import type { Contacto } from "@/lib/types";
import { Loader2 } from "lucide-react";

const schema = z.object({
  nombre: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
  empresa: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacto: Contacto | null;
  onActualizado?: () => void;
};

export function EditarContactoNombreDialog({ open, onOpenChange, contacto, onActualizado }: Props) {
  const { toast } = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: "", empresa: "" },
  });

  useEffect(() => {
    if (open && contacto) {
      const inicial =
        contacto.nombre?.trim() ||
        contacto.email.split("@")[0] ||
        "";
      form.reset({ nombre: inicial, empresa: contacto.empresa || "" });
    }
  }, [open, contacto, form]);

  const onSubmit = async (data: FormValues) => {
    if (!contacto?.id) return;

    try {
      await actualizarContacto(contacto.id, {
        nombre: data.nombre,
        empresa: data.empresa,
      });
      toast({
        title: "Contacto actualizado",
        description: `Se guardaron los datos de ${contacto.email}.`,
      });
      onActualizado?.();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast({
        title: "No se pudo guardar",
        description: e instanceof Error ? e.message : "Intentá de nuevo en unos segundos.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar contacto</DialogTitle>
          <DialogDescription>
            Estos datos son solo para tu agenda; no cambian el correo del destinatario ({contacto?.email}).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-contacto-nombre">Nombre</Label>
            <Input
              id="edit-contacto-nombre"
              autoComplete="name"
              {...form.register("nombre")}
              aria-invalid={!!form.formState.errors.nombre}
            />
            {form.formState.errors.nombre?.message ? (
              <p className="text-sm text-destructive">{form.formState.errors.nombre.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-contacto-empresa">Empresa (Opcional)</Label>
            <Input
              id="edit-contacto-empresa"
              autoComplete="organization"
              placeholder="Nombre de la organización"
              {...form.register("empresa")}
            />
            <p className="text-xs text-muted-foreground">
              Agrupa varios contactos de la misma organización.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
