"use client"

import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, PenSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
import { Checkbox } from "../ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"

const messageSchema = z.object({
  recipient: z.string().email({ message: "Dirección de correo electrónico inválida." }),
  content: z.string().min(10, { message: "El mensaje debe tener al menos 10 caracteres." }),
  priority: z.enum(["normal", "alta", "urgente"]),
  requireCertificate: z.boolean(),
})

type MessageFormValues = z.infer<typeof messageSchema>

export function ComposeMessageDialog({ children, open, onOpenChange }: { children: React.ReactNode, open: boolean, onOpenChange: (open: boolean) => void }) {
    const [isSending, setIsSending] = useState(false);
    const { toast } = useToast();
    const form = useForm<MessageFormValues>({
        resolver: zodResolver(messageSchema),
        defaultValues: {
            recipient: "",
            content: "",
            priority: "normal",
            requireCertificate: true,
        },
    });

    const onSubmit = async (data: MessageFormValues) => {
        setIsSending(true);
        console.log("Enviando mensaje:", data);
        // Simular llamada a la API
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsSending(false);
        onOpenChange(false);
        toast({
            title: "Mensaje Enviado y Certificado",
            description: "Tu mensaje ha sido enviado y certificado en BFA.",
            variant: "default",
        });
        form.reset();
    }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Redactar Nuevo Mensaje Certificado</DialogTitle>
          <DialogDescription>
            Este mensaje será encriptado y certificado en Blockchain Federal Argentina.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="recipient">Email del Destinatario</Label>
                <Input id="recipient" {...form.register("recipient")} placeholder="destinatario@ejemplo.com" />
                {form.formState.errors.recipient && <p className="text-sm text-destructive">{form.formState.errors.recipient.message}</p>}
            </div>
            <div className="grid gap-2">
                <Label htmlFor="content">Contenido del Mensaje</Label>
                <Textarea id="content" {...form.register("content")} placeholder="Escribe tu mensaje certificado aquí." className="min-h-[150px]" />
                {form.formState.errors.content && <p className="text-sm text-destructive">{form.formState.errors.content.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="priority">Prioridad</Label>
                     <Select onValueChange={(value) => form.setValue('priority', value as "normal" | "alta" | "urgente")} defaultValue="normal">
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccionar prioridad" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="urgente">Urgente</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-end pb-2">
                     <div className="flex items-center space-x-2">
                        <Checkbox id="require-certificate" {...form.register("requireCertificate")} defaultChecked={true} />
                        <Label htmlFor="require-certificate" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Requerir Certificado
                        </Label>
                    </div>
                </div>
            </div>

            <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSending}>
                {isSending ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                    </>
                ) : (
                    <>
                        <PenSquare className="mr-2 h-4 w-4" />
                        Enviar Mensaje Certificado
                    </>
                )}
            </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
