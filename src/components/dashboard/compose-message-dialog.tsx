"use client"

import { useForm } from "react-hook-form"
import { useState, useRef, useEffect, useCallback } from 'react';
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, PenSquare, MessageCircle } from "lucide-react"

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
import { EmailAutocomplete } from "@/components/ui/email-autocomplete"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
import { Checkbox } from "../ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { User } from "@/lib/types"
import { scheduleEmail, sendEmailManually } from "@/lib/email";
import { addDoc, collection, serverTimestamp, updateDoc, doc, increment } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { guardarContacto } from "@/lib/contactos";
import { PDFUpload } from "./pdf-upload";
import { uploadPDF } from "@/lib/storage";

const messageSchema = z.object({
  recipient: z.string().email({ message: "Dirección de correo electrónico inválida." }),
  recipientPhone: z.string().optional().refine((v) => !v || /^[\d\s\+\-\(\)]{8,25}$/.test(v), "Número inválido. Ej: +54 11 1234-5678, 011 1234-5678, 9 11 1234-5678"),
  content: z.string().min(10, { message: "El mensaje debe tener al menos 10 caracteres." }),
  priority: z.enum(["normal", "alta", "urgente"]),
  requireCertificate: z.boolean(),
  attachments: z.array(z.any()).optional(),
})

type MessageFormValues = z.infer<typeof messageSchema>

export function ComposeMessageDialog({ children, open, onOpenChange, user, initialContact }: { children: React.ReactNode, open: boolean, onOpenChange: (open: boolean) => void, user: User, initialContact?: { email: string, nombre?: string, telefono?: string } }) {
    const [isSending, setIsSending] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
    const isExecutingRef = useRef(false);
    const currentExecutionIdRef = useRef<string | null>(null);
    let renderCount = 0;
    const { toast } = useToast();
    const form = useForm<MessageFormValues>({
        resolver: zodResolver(messageSchema),
        defaultValues: {
            recipient: "",
            recipientPhone: "",
            content: "",
            priority: "normal",
            requireCertificate: true,
            attachments: [],
        },
    });

    const isSuspended = user.estado === 'suspendido';

    // Establecer contacto inicial cuando se abre el diálogo
    useEffect(() => {
        if (open && initialContact) {
            form.setValue('recipient', initialContact.email);
            if (initialContact.telefono) form.setValue('recipientPhone', initialContact.telefono);
        } else if (open && !initialContact) {
            form.setValue('recipient', '');
            form.setValue('recipientPhone', '');
        }
    }, [open, initialContact, form]);

    const onSubmit = useCallback(async (data: MessageFormValues) => {
        console.log('🚀 onSubmit called with:', { recipient: data.recipient, isExecuting: isExecutingRef.current });
        
        if (isSuspended) {
            toast({
                title: "Cuenta Suspendida",
                description: "No puedes enviar mensajes. Por favor, regulariza tu situación de pago.",
                variant: "destructive",
            });
            return;
        }

        // Validar que el usuario tenga créditos suficientes
        if (user.creditos <= 0) {
            toast({
                title: "Sin Créditos",
                description: "No tienes créditos suficientes para enviar mensajes. Ve a la billetera para recargar.",
                variant: "destructive",
            });
            return;
        }

        // 🚨 PROTECCIÓN ROBUSTA CONTRA DUPLICADOS
        if (isExecutingRef.current) {
            console.log('⚠️ Envío ya en progreso, ignorando llamada duplicada');
            return;
        }

        // 🚨 BLOQUEAR INMEDIATAMENTE
        isExecutingRef.current = true;
        console.log('🔒 Bloqueo activado');

        const executionId = Math.random().toString(36).substring(7);
        console.log('🆔 Execution ID:', executionId);
        currentExecutionIdRef.current = executionId;
        setIsSending(true);
        
        // Declarar uploadedAttachments al inicio
        let uploadedAttachments: any[] = [];
        
        try {
            const sender = auth.currentUser?.email || user.email;
            const subject = `Mensaje certificado para ${data.recipient}`;
            
            // Crear el documento primero (sin HTML completo todavía, sin enviar)
            // Esto nos da el mailId que necesitamos para subir los archivos
            const recipientPhone = data.recipientPhone?.trim() || undefined;
            const mailId = await scheduleEmail({
                to: data.recipient,
                subject,
                html: '<p>Cargando contenido...</p>', // Placeholder temporal
                from: 'contacto@notificas.com',
                replyTo: sender,
                senderName: user.email,
                recipientName: data.recipient.split('@')[0],
                recipientEmail: data.recipient,
                recipientPhone,
                createdBy: user.uid,
                skipAutoSend: true // No enviar automáticamente
            });
            
            // Subir archivos adjuntos si los hay (ahora con el mailId correcto)
            console.log('🔍 DEBUG: selectedFiles.length =', selectedFiles.length);
            console.log('🔍 DEBUG: selectedFiles =', selectedFiles);
            if (selectedFiles.length > 0) {
                console.log('📎 Subiendo archivos adjuntos...', selectedFiles);
                try {
                    // Mostrar toast de progreso
                    toast({
                        title: "Subiendo archivos adjuntos...",
                        description: `Subiendo ${selectedFiles.length} archivo(s). Esto puede tomar unos minutos.`,
                        variant: "default",
                    });
                    
                    const uploadPromises = selectedFiles.map(async (file, index) => {
                        console.log(`📤 Subiendo archivo ${index + 1}/${selectedFiles.length}: ${file.name}`);
                        return await uploadPDF(file.file, mailId, user.uid || 'anonymous');
                    });
                    
                    uploadedAttachments = await Promise.all(uploadPromises);
                    console.log('✅ Archivos adjuntos subidos:', uploadedAttachments);
                    
                    toast({
                        title: "Archivos adjuntos subidos",
                        description: `${uploadedAttachments.length} archivo(s) subido(s) exitosamente.`,
                        variant: "default",
                    });
                } catch (error: any) {
                    console.error('❌ Error al subir archivos adjuntos:', error);
                    toast({
                        title: "Error en archivos adjuntos",
                        description: error.message || "No se pudieron subir algunos archivos. El mensaje se enviará sin adjuntos.",
                        variant: "destructive",
                    });
                }
            }

            // Generar HTML completo DESPUÉS de subir archivos adjuntos
            const attachmentsSection = uploadedAttachments.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">📎 Documentos Adjuntos (${uploadedAttachments.length}):</h2>
                    <div style="background: #f8fafc; padding: 16px; border-radius: 6px; border-left: 4px solid #0D9488;">
                        ${uploadedAttachments.map((file, index) => `
                            <div style="margin-bottom: 12px; padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 40px; height: 40px; background: #dc2626; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                                        <span style="color: white; font-weight: bold; font-size: 12px;">${file.name.split('.').pop()?.toUpperCase() || 'DOC'}</span>
                                    </div>
                                    <div style="flex: 1;">
                                        <h4 style="margin: 0 0 4px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${file.name}</h4>
                                        <p style="margin: 0; color: #64748b; font-size: 12px;">${(file.size / 1024 / 1024).toFixed(2)} MB • Con hash de integridad</p>
                                    </div>
                                    <a href="${file.url}" 
                                       style="background: #0D9488; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600; display: inline-block;">
                                        Ver Documento
                                    </a>
                                </div>
                                ${file.hash ? `
                                    <div style="margin-top: 8px; padding: 8px; background: #f0f9ff; border-radius: 4px; border: 1px solid #0ea5e9;">
                                        <p style="margin: 0; color: #0c4a6e; font-size: 11px; font-family: monospace; word-break: break-all;">
                                            <strong>Hash SHA-256:</strong> ${file.hash}
                                        </p>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                        <p style="margin: 12px 0 0 0; color: #64748b; font-size: 11px; font-style: italic;">
                            💡 Los documentos adjuntos incluyen hash de integridad para verificar que no han sido modificados.
                        </p>
                    </div>
                </div>
            ` : '';

            const recipientName = data.recipient.split('@')[0];
            const year = new Date().getFullYear();
            
            // Template completo de notificación con toda la información
            const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Nueva notificacion digital</title>
  <style>
    body, table, td, a { font-family: "Inter", -apple-system, Segoe UI, Roboto, Arial, sans-serif !important; }
    body { margin: 0; padding: 0; background-color: #F8FAFC; color: #1E293B; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #F8FAFC; padding: 24px 0; }
    .container { width: 100%; max-width: 800px; background: #ffffff; margin: 0 auto; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; }
    .header { background: #0D9488; color: #ffffff; padding: 20px 24px; }
    .badge { display: inline-block; background: #1E3A8A; color: #fff; font-size: 12px; letter-spacing: .4px; padding: 4px 8px; border-radius: 999px; }
    .title { margin: 10px 0 0 0; font-size: 20px; line-height: 1.3; font-weight: 700; }
    .content { padding: 24px; }
    .lead { font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; }
    .list { padding-left: 18px; margin: 0 0 16px 0; }
    .btn { display: inline-block; background: #0D9488; color: #ffffff !important; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 700; }
    .btn:hover { background: #0F766E; }
    .muted { color: #64748B; font-size: 12px; line-height: 1.6; }
    .divider { height: 1px; background: #E2E8F0; margin: 20px 0; }
    .footer { padding: 16px 24px 24px; }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Notificacion digital enviada por ${sender} a traves de Notificas.com
  </div>
  <table role="presentation" class="wrapper" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" class="container" cellspacing="0" cellpadding="0">
          <tr>
            <td class="header">
              <span class="badge">NOTIFICACION</span>
              <div class="title">Nueva comunicacion para usted</div>
              <div style="margin-top:6px;font-size:13px;opacity:.9;">
                Enviada por <strong>${sender}</strong> mediante <strong>Notificas.com</strong>
              </div>
            </td>
          </tr>
          <tr>
            <td class="content">
              <p class="lead">Estimado/a ${recipientName},</p>
              <p class="lead">
                Ha recibido una <strong>comunicacion fehaciente digital</strong> remitida por <strong>${sender}</strong>. 
                Le recomendamos acceder a su contenido, ya que puede ser relevante para:
              </p>
              <ul class="list">
                <li><strong>Responder en tiempo y forma</strong>.</li>
                <li><strong>Ejercer sus derechos</strong> y dejar constancia tecnica de acceso.</li>
                <li><strong>Conservar evidencia</strong> de recepcion y lectura.</li>
              </ul>
              
              <div style="margin: 20px 0;">
                <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Contenido del Mensaje:</h2>
                <div style="background: #f8fafc; padding: 16px; border-radius: 6px; border-left: 4px solid #0D9488;">
                  ${data.content.split('\n').map(line => `<p style="margin: 0 0 8px 0; line-height: 1.6; color: #334155;">${line}</p>`).join('')}
                </div>
              </div>
              
              ${attachmentsSection}
              
              <div style="background: #f1f5f9; padding: 16px; border-radius: 6px; border: 1px solid #e2e8f0; margin: 20px 0;">
                <h3 style="margin: 0 0 8px 0; color: #475569; font-size: 14px; font-weight: 600;">Detalles del Envío:</h3>
                <ul style="margin: 0; padding-left: 20px; color: #64748b; font-size: 13px;">
                  <li>Prioridad: <strong>${data.priority}</strong></li>
                  <li>Certificado requerido: <strong>${data.requireCertificate ? 'Sí' : 'No'}</strong></li>
                  <li>Fecha: <strong>${new Date().toLocaleDateString('es-ES')}</strong></li>
                  ${uploadedAttachments.length > 0 ? `<li>Documentos adjuntos: <strong>${uploadedAttachments.length} archivo(s) con hash de integridad</strong></li>` : ''}
                </ul>
              </div>
              
              <p style="margin: 20px 0;">
                <a class="btn" href="#" target="_blank" rel="noopener">Leer Notificacion</a>
              </p>
              <p class="muted">
                Si el boton no funciona, copie y pegue este enlace en su navegador:<br>
                <a href="#" target="_blank" rel="noopener" style="color:inherit;">[El enlace se agregará al enviar el mensaje]</a>
              </p>
              <div class="divider"></div>
              <p class="muted">
                Este correo no incluye adjuntos por razones de confidencialidad. La notificacion, sus metadatos de envio, 
                recepcion y lectura quedan <strong>certificados y registrados</strong> en la red Blockchain a traves de Notificas.com. 
                Esta constancia tecnica no implica conformidad con el contenido.
              </p>
              <p class="muted" style="margin-top:12px;">
                Para dejar constancia de que ha accedido al mensaje, puede utilizar el siguiente enlace:<br>
                <a href="#confirm" target="_blank" rel="noopener" style="color:inherit;">Confirmar lectura</a>
              </p>
            </td>
          </tr>
          <tr>
            <td class="footer">
              <div class="muted">
                 ${year} Notificas.com  Este mensaje fue destinado a ${data.recipient}. 
                Si no reconoce esta notificacion, ignore este correo o responda a 
                <a href="mailto:contacto@notificas.com" style="color:inherit;">contacto@notificas.com</a>.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
            
            // Actualizar el documento con el HTML completo y los archivos adjuntos
            const mailRef = doc(db, 'mail', mailId);
            const updateData: any = {
                'message.html': html
            };

            if (uploadedAttachments.length > 0) {
                const attachmentsData = uploadedAttachments.map((file, index) => ({
                    id: `${mailId}_${index}`,
                    fileName: file.name,
                    fileUrl: file.url,
                    fileSize: file.size,
                    uploadedAt: file.uploadedAt,
                    hash: file.hash,
                    integrityCertificate: file.integrityCertificate
                }));
                
                console.log('📎 Guardando archivos adjuntos:', attachmentsData);
                
                updateData.attachments = attachmentsData;
                updateData.attachmentsHashes = uploadedAttachments.map(file => file.hash);
                updateData['tracking.attachmentsOpened'] = 0;
            }

            console.log('🔍 DEBUG: updateData =', updateData);
            await updateDoc(mailRef, updateData);
            console.log('✅ Email actualizado con HTML completo y archivos adjuntos');

            // Descontar 1 crédito del usuario después de enviar el mensaje
            try {
                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, {
                    creditos: increment(-1), // Descontar 1 crédito
                    updatedAt: new Date()
                });
                console.log('✅ 1 crédito descontado del usuario');

                // Registrar la transacción de descuento
                const transactionRef = await addDoc(collection(db, 'user_transactions'), {
                    userId: user.uid,
                    tipo: 'envio',
                    descripcion: `Envío de mensaje certificado a ${data.recipient}`,
                    monto: 0,
                    creditos: -1, // Descuento de 1 crédito
                    metodoPago: 'Créditos',
                    fecha: new Date(),
                    mailId: mailId
                });
                console.log('✅ Transacción de descuento registrada');
            } catch (error) {
                console.error('❌ Error al descontar crédito:', error);
                // No lanzar error para no interrumpir el envío del mensaje
            }

            // 🚀 ENVIAR EL CORREO DESPUÉS de tener todo listo (HTML completo y archivos adjuntos)
            console.log('📧 Enviando correo con HTML completo...');
            const sendResult = await sendEmailManually(mailId);
            console.log('✅ Correo enviado exitosamente');

            // Guardar contacto para autocompletado futuro (con teléfono si se proporcionó)
            if (user.uid) {
                await guardarContacto(user.uid, data.recipient, undefined, undefined, recipientPhone);
            }

            console.log('✅ Mensaje enviado y guardado en colección mail con ID:', mailId);
            console.log('🏁 Proceso completado para executionId:', executionId);

            let toastDesc = `Tu mensaje ha sido enviado y certificado en BFA.${uploadedAttachments.length > 0 ? ` ${uploadedAttachments.length} archivo(s) adjunto(s) con hash de integridad.` : ''}`;
            if (recipientPhone && sendResult.whatsappError) {
                toastDesc += ` WhatsApp: ${sendResult.whatsappError}`;
            }

            toast({
                title: sendResult.whatsappError && recipientPhone ? "Enviado (WhatsApp falló)" : "Mensaje Enviado y Certificado",
                description: toastDesc,
                variant: sendResult.whatsappError && recipientPhone ? "default" : "default",
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
            // 🚨 SOLO RESETEAR SI ES LA MISMA EJECUCIÓN
            if (currentExecutionIdRef.current === executionId) {
                isExecutingRef.current = false;
                currentExecutionIdRef.current = null;
                setIsSending(false);
            }
        }
    }, [isSuspended, toast, user, auth, scheduleEmail, guardarContacto, onOpenChange]);

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
                    <EmailAutocomplete
                        value={form.watch("recipient")}
                        onChange={(value) => form.setValue("recipient", value)}
                        onBlur={() => form.trigger("recipient")}
                        onContactSelect={(c) => c.telefono && form.setValue("recipientPhone", c.telefono)}
                        placeholder="destinatario@ejemplo.com"
                        label="Email del Destinatario"
                        error={form.formState.errors.recipient?.message}
                        userId={user.uid || ''}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="recipientPhone">
                        <MessageCircle className="inline h-4 w-4 mr-2" />
                        Teléfono WhatsApp (opcional)
                    </Label>
                    <Input
                        id="recipientPhone"
                        type="tel"
                        placeholder="+54 11 1234-5678, 011 1234-5678, 9 11 1234-5678"
                        {...form.register("recipientPhone")}
                    />
                    <p className="text-xs text-muted-foreground">
                        Si agregas un número, se enviará un mensaje de WhatsApp además del correo.
                    </p>
                    {form.formState.errors.recipientPhone && (
                        <p className="text-sm text-destructive">{form.formState.errors.recipientPhone.message}</p>
                    )}
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

                {/* Sección de Archivos Adjuntos */}
                <div className="space-y-4">
                    <PDFUpload 
                        onFileSelect={(files) => {
                            setSelectedFiles(files);
                            form.setValue('attachments', files);
                        }}
                        maxFiles={3} 
                        maxSizeMB={10} 
                    />
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
