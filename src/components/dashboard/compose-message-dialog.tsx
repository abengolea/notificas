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
import { User } from "@/lib/types"
import { scheduleEmail } from "@/lib/email";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const messageSchema = z.object({
  recipient: z.string().email({ message: "Dirección de correo electrónico inválida." }),
  content: z.string().min(10, { message: "El mensaje debe tener al menos 10 caracteres." }),
  priority: z.enum(["normal", "alta", "urgente"]),
  requireCertificate: z.boolean(),
})

type MessageFormValues = z.infer<typeof messageSchema>

export function ComposeMessageDialog({ children, open, onOpenChange, user }: { children: React.ReactNode, open: boolean, onOpenChange: (open: boolean) => void, user: User }) {
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

    const isSuspended = user.estado === 'suspendido';

    const onSubmit = async (data: MessageFormValues) => {
        if (isSuspended) {
            toast({
                title: "Cuenta Suspendida",
                description: "No puedes enviar mensajes. Por favor, regulariza tu situación de pago.",
                variant: "destructive",
            });
            return;
        }

        setIsSending(true);
        try {
            const sender = auth.currentUser?.email || user.email;
            const subject = `Mensaje certificado de ${sender}`;
            
            // Crear HTML más rico para el mensaje
            const html = `
                <div style="font-family: 'Inter', -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="background: #0D9488; color: #ffffff; padding: 20px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Mensaje Certificado</h1>
                        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Enviado por ${sender}</p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Contenido del Mensaje:</h2>
                        <div style="background: #f8fafc; padding: 16px; border-radius: 6px; border-left: 4px solid #0D9488;">
                            ${data.content.split('\n').map(line => `<p style="margin: 0 0 8px 0; line-height: 1.6; color: #334155;">${line}</p>`).join('')}
                        </div>
                    </div>
                    
                    <div style="background: #f1f5f9; padding: 16px; border-radius: 6px; border: 1px solid #e2e8f0;">
                        <h3 style="margin: 0 0 8px 0; color: #475569; font-size: 14px; font-weight: 600;">Detalles del Envío:</h3>
                        <ul style="margin: 0; padding-left: 20px; color: #64748b; font-size: 13px;">
                            <li>Prioridad: <strong>${data.priority}</strong></li>
                            <li>Certificado requerido: <strong>${data.requireCertificate ? 'Sí' : 'No'}</strong></li>
                            <li>Fecha: <strong>${new Date().toLocaleDateString('es-ES')}</strong></li>
                        </ul>
                    </div>
                    
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px;">
                        Este mensaje ha sido certificado y registrado en la red Blockchain a través de Notificas.com
                    </div>
                </div>
            `;

            // Programar email real (from fijo + replyTo al usuario)
            const mailId = await scheduleEmail({
                to: data.recipient,
                subject,
                html,
                from: 'contacto@notificas.com',
                replyTo: sender,
                senderName: user.name || user.email, // Usar nombre real del usuario
                recipientName: data.recipient.split('@')[0], // Nombre del destinatario
                recipientEmail: data.recipient
            });

            // Registrar mensaje en colección 'messages' para UI
            await addDoc(collection(db, 'messages'), {
                mailId,
                from: sender,
                to: data.recipient,
                subject,
                content: data.content,
                priority: data.priority,
                requireCertificate: data.requireCertificate,
                createdAt: serverTimestamp(),
                status: 'SENT',
            });

            toast({
                title: "Mensaje Enviado y Certificado",
                description: "Tu mensaje ha sido enviado y certificado en BFA.",
                variant: "default",
            });
            onOpenChange(false);
            form.reset();
        } catch (e:any) {
            toast({
                title: "Error al enviar",
                description: e?.message || 'No se pudo enviar el mensaje',
                variant: "destructive",
            });
        } finally {
            setIsSending(false);
        }
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
            <fieldset disabled={isSuspended}>
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
            </fieldset>

            <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSending || isSuspended}>
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
         {isSuspended && (
            <div className="text-center text-sm text-destructive mt-4 p-2 bg-destructive/10 rounded-md">
                Tu cuenta está suspendida. No puedes enviar nuevos mensajes.
            </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
