"use client"

import { useForm } from "react-hook-form"
import { useState, useRef, useEffect, useCallback, type ClipboardEvent } from 'react';
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import {
    AlignCenter,
    AlignJustify,
    AlignLeft,
    AlignRight,
    Bold,
    Eraser,
    Italic,
    Link as LinkIcon,
    List,
    ListOrdered,
    Loader2,
    MessageCircle,
    PenSquare,
    Quote,
    Underline,
} from "lucide-react"

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
import { useToast } from "@/hooks/use-toast"
import { User } from "@/lib/types"
import { scheduleEmail, sendEmailManually, type SendEmailResult } from "@/lib/email";
import { addDoc, collection, updateDoc, doc, increment } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { PDFUpload } from "./pdf-upload";
import { uploadPDF, type UploadedFile } from "@/lib/storage";
import { EmailAutocomplete } from "@/components/ui/email-autocomplete";
import {
    escapeHtml,
    normalizeLinkInput,
    plainTextToHtml,
    renderRichMessageContent,
    sanitizeRichTextHtml,
    stripRichTextToPlainText,
} from "@/lib/rich-text";

function buildComposeMailHtml(params: {
  recipientEmail: string;
  content: string;
  sender: string;
  uploadedAttachments: UploadedFile[];
}): string {
  const { recipientEmail, content, sender, uploadedAttachments } = params;
  const recipientName = recipientEmail.split("@")[0];
  const contentSection = content?.trim()
    ? `
                <div class="message-content" data-email-hide style="margin: 20px 0;">
                  <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Contenido del Mensaje:</h2>
                  <div class="rich-message-content" style="background: #f8fafc; padding: 16px; border-radius: 6px; border-left: 4px solid #0D9488; line-height: 1.6; color: #334155;">
                    ${renderRichMessageContent(content)}
                  </div>
                </div>`
    : "";

  const attachmentsSection =
    uploadedAttachments.length > 0
      ? `
                <div data-email-hide style="margin-bottom: 20px;">
                    <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">📎 Documentos Adjuntos (${uploadedAttachments.length}):</h2>
                    <div style="background: #f8fafc; padding: 16px; border-radius: 6px; border-left: 4px solid #0D9488;">
                        ${uploadedAttachments
                          .map(
                            (file) => `
                            <div style="margin-bottom: 12px; padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 40px; height: 40px; background: #dc2626; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                                        <span style="color: white; font-weight: bold; font-size: 12px;">${String(file.name.split(".").pop() || "DOC").toUpperCase()}</span>
                                    </div>
                                    <div style="flex: 1;">
                                        <h4 style="margin: 0 0 4px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${escapeHtml(file.name)}</h4>
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
                                ` : ""}
                            </div>
                        `
                          )
                          .join("")}
                        <p style="margin: 12px 0 0 0; color: #64748b; font-size: 11px; font-style: italic;">
                            💡 Los documentos adjuntos incluyen hash de integridad para verificar que no han sido modificados.
                        </p>
                    </div>
                </div>
            `
      : "";

  const year = new Date().getFullYear();
  const hasInlineBody = !!stripRichTextToPlainText(content || "");
  const leadSecondParagraph = hasInlineBody
    ? `Ha recibido una <strong>comunicacion fehaciente digital</strong> de <strong>${escapeHtml(sender)}</strong>.
                Puede leer el texto en este mismo correo; para la <strong>constancia fehaciente de lectura</strong> en la plataforma, use el enlace siguiente.`
    : `Ha recibido una <strong>comunicacion fehaciente digital</strong> de <strong>${escapeHtml(sender)}</strong>.
                <strong>Le recomendamos abrir el mensaje</strong> mediante el enlace para conocer el contenido y dejar constancia certificada de lectura.`;

  return `<!doctype html>
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
    Notificacion digital enviada por ${escapeHtml(sender)} a traves de Notificas.com
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
                Enviada por <strong>${escapeHtml(sender)}</strong> mediante <strong>Notificas.com</strong>
              </div>
            </td>
          </tr>
          <tr>
            <td class="content">
              <p class="lead">Estimado/a ${escapeHtml(recipientName)},</p>
              <p class="lead">
                ${leadSecondParagraph}
              </p>

              ${contentSection}

              ${attachmentsSection}

              <p style="margin: 20px 0;">
                <a class="btn" href="#" target="_blank" rel="noopener">Acceder a la notificación</a>
              </p>
              <p class="muted">
                Si el boton no funciona, copie y pegue este enlace en su navegador:<br>
                <a href="#" target="_blank" rel="noopener" style="color:inherit;">[El enlace se agregará al enviar el mensaje]</a>
              </p>
              <div class="divider"></div>
              <p class="muted">
                La notificacion, sus metadatos de envio,
                recepcion y lectura quedan <strong>certificados y registrados</strong> en la blockchain de Polygon a traves de Notificas.com.
                Esta constancia tecnica no implica conformidad con el contenido.
              </p>
            </td>
          </tr>
          <tr>
            <td class="footer">
              <div class="muted">
                 ${year} Notificas.com  Este mensaje fue destinado a ${escapeHtml(recipientEmail)}.
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
}

type SelectedAttachment = {
  file: File;
  name: string;
  size: number;
  preview?: string;
};

const messageSchema = z.object({
  recipient: z.string().email({ message: "Dirección de correo electrónico inválida." }),
  recipientPhone: z.string().optional().refine((v) => !v || /^[\d\s\+\-\(\)]{8,25}$/.test(v), "Número inválido. Ej: +54 11 1234-5678, 011 1234-5678, 9 11 1234-5678"),
  content: z.string().refine((value) => stripRichTextToPlainText(value).length >= 10, {
    message: "El mensaje debe tener al menos 10 caracteres.",
  }),
  attachments: z.array(z.custom<SelectedAttachment>()).optional(),
})

type MessageFormValues = z.infer<typeof messageSchema>

type RichTextEditorProps = {
    value: string;
    disabled?: boolean;
    onChange: (value: string) => void;
    onBlur: () => void;
};

function RichTextEditor({ value, disabled, onChange, onBlur }: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const isEmpty = stripRichTextToPlainText(value).length === 0;

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || editor.innerHTML === value) return;
        editor.innerHTML = value || "";
    }, [value]);

    const syncFromEditor = useCallback(() => {
        const html = editorRef.current?.innerHTML || "";
        onChange(stripRichTextToPlainText(html) ? html : "");
    }, [onChange]);

    const sanitizeAndSync = useCallback(() => {
        const editor = editorRef.current;
        if (!editor) return;
        const sanitized = sanitizeRichTextHtml(editor.innerHTML);
        editor.innerHTML = stripRichTextToPlainText(sanitized) ? sanitized : "";
        onChange(editor.innerHTML);
    }, [onChange]);

    const exec = useCallback((command: string, commandValue?: string) => {
        const editor = editorRef.current;
        if (!editor || disabled) return;
        editor.focus();
        document.execCommand(command, false, commandValue);
        syncFromEditor();
    }, [disabled, syncFromEditor]);

    const handlePaste = useCallback((event: ClipboardEvent<HTMLDivElement>) => {
        if (disabled) return;
        event.preventDefault();
        const html = event.clipboardData.getData("text/html");
        const text = event.clipboardData.getData("text/plain");
        const pastedHtml = html ? sanitizeRichTextHtml(html) : plainTextToHtml(text);
        document.execCommand("insertHTML", false, pastedHtml || escapeHtml(text));
        syncFromEditor();
    }, [disabled, syncFromEditor]);

    const handleBlur = useCallback(() => {
        sanitizeAndSync();
        onBlur();
    }, [onBlur, sanitizeAndSync]);

    const createLink = useCallback(() => {
        if (disabled) return;
        const rawUrl = window.prompt("Pegá el enlace que querés insertar:");
        if (!rawUrl) return;
        const safeUrl = normalizeLinkInput(rawUrl);
        if (!safeUrl) return;
        exec("createLink", safeUrl);
        sanitizeAndSync();
    }, [disabled, exec, sanitizeAndSync]);

    const toolbarButtonClass = "h-8 w-8 p-0";

    return (
        <div className="rounded-md border border-input bg-background">
            <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 p-2">
                <select
                    aria-label="Formato de párrafo"
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    disabled={disabled}
                    defaultValue="p"
                    onChange={(event) => exec("formatBlock", `<${event.target.value}>`)}
                >
                    <option value="p">Párrafo</option>
                    <option value="h2">Título</option>
                    <option value="h3">Subtítulo</option>
                    <option value="blockquote">Cita</option>
                </select>
                <Button type="button" variant="ghost" size="icon" className={toolbarButtonClass} disabled={disabled} title="Negrita" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}>
                    <Bold className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className={toolbarButtonClass} disabled={disabled} title="Cursiva" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}>
                    <Italic className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className={toolbarButtonClass} disabled={disabled} title="Subrayado" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")}>
                    <Underline className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className={toolbarButtonClass} disabled={disabled} title="Lista" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}>
                    <List className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className={toolbarButtonClass} disabled={disabled} title="Lista numerada" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")}>
                    <ListOrdered className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className={toolbarButtonClass} disabled={disabled} title="Cita" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "<blockquote>")}>
                    <Quote className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className={toolbarButtonClass} disabled={disabled} title="Alinear izquierda" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyLeft")}>
                    <AlignLeft className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className={toolbarButtonClass} disabled={disabled} title="Centrar" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyCenter")}>
                    <AlignCenter className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className={toolbarButtonClass} disabled={disabled} title="Alinear derecha" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyRight")}>
                    <AlignRight className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className={toolbarButtonClass} disabled={disabled} title="Justificar" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyFull")}>
                    <AlignJustify className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className={toolbarButtonClass} disabled={disabled} title="Insertar enlace" onMouseDown={(e) => e.preventDefault()} onClick={createLink}>
                    <LinkIcon className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className={toolbarButtonClass} disabled={disabled} title="Limpiar formato" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("removeFormat")}>
                    <Eraser className="h-4 w-4" />
                </Button>
            </div>
            <div className="relative">
                {isEmpty && (
                    <span className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">
                        Escribe tu mensaje certificado aquí. También podés pegar texto con formato.
                    </span>
                )}
                <div
                    ref={editorRef}
                    role="textbox"
                    aria-multiline="true"
                    contentEditable={!disabled}
                    suppressContentEditableWarning
                    className="min-h-[170px] rounded-b-md px-3 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-6"
                    onInput={syncFromEditor}
                    onBlur={handleBlur}
                    onPaste={handlePaste}
                    onDrop={(event) => event.preventDefault()}
                />
            </div>
        </div>
    );
}

export function ComposeMessageDialog({ children, open, onOpenChange, user, initialContact }: { children: React.ReactNode, open: boolean, onOpenChange: (open: boolean) => void, user: User, initialContact?: { email: string, nombre?: string, telefono?: string } }) {
    const [isSending, setIsSending] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<SelectedAttachment[]>([]);
    const isExecutingRef = useRef(false);
    const currentExecutionIdRef = useRef<string | null>(null);
    const { toast } = useToast();
    const form = useForm<MessageFormValues>({
        resolver: zodResolver(messageSchema),
        mode: "onBlur", // Evita validar en cada tecla mientras el usuario escribe o busca contactos
        defaultValues: {
            recipient: "",
            recipientPhone: "",
            content: "",
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
        if (isSuspended) {
            toast({
                title: "Cuenta Suspendida",
                description: "No puedes enviar mensajes. Por favor, regulariza tu situación de pago.",
                variant: "destructive",
            });
            return;
        }

        const sanitizedContent = sanitizeRichTextHtml(data.content);
        const plainContent = stripRichTextToPlainText(sanitizedContent);
        if (plainContent.length < 10) {
            form.setError("content", {
                type: "manual",
                message: "El mensaje debe tener al menos 10 caracteres.",
            });
            return;
        }

        if (isExecutingRef.current) return;

        isExecutingRef.current = true;
        const executionId = Math.random().toString(36).substring(7);
        currentExecutionIdRef.current = executionId;
        setIsSending(true);

        try {
            const recipientEmail = data.recipient.trim().toLowerCase();
            const subject = `Mensaje certificado para ${recipientEmail}`;

            if (user.creditos < 1) {
                toast({
                    title: "Sin envíos",
                    description: "No tenés envíos suficientes para enviar un mensaje certificado.",
                    variant: "destructive",
                });
                return;
            }

            const sender = auth.currentUser?.email || user.email;
            const phoneForWhatsApp = data.recipientPhone?.trim() || undefined;

            let uploadedAttachments: UploadedFile[] = [];

            const mailId = await Promise.race([
                scheduleEmail({
                    to: recipientEmail,
                    subject,
                    html: '<p>Cargando contenido...</p>',
                    from: 'contacto@notificas.com',
                    replyTo: sender,
                    senderName: user.email,
                    recipientName: recipientEmail.split('@')[0],
                    recipientEmail,
                    recipientPhone: phoneForWhatsApp,
                    createdBy: user.uid,
                    skipAutoSend: true,
                }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('No se pudo crear el mensaje. Revisa tu conexión e intentá de nuevo.')), 30_000)
                ),
            ]);

            if (selectedFiles.length > 0) {
                toast({
                    title: "Subiendo archivos adjuntos...",
                    description: `Subiendo ${selectedFiles.length} archivo(s). Esto puede tomar unos minutos.`,
                    variant: "default",
                });
                const uploadPromises = selectedFiles.map((file) =>
                    uploadPDF(file.file, mailId, user.uid || 'anonymous')
                );
                const results = await Promise.allSettled(uploadPromises);
                const failed = results.filter((r) => r.status === 'rejected');
                uploadedAttachments = results
                    .filter((r): r is PromiseFulfilledResult<UploadedFile> => r.status === 'fulfilled')
                    .map((r) => r.value);
                if (failed.length > 0) {
                    toast({
                        title: "Algunos archivos no se pudieron subir",
                        description: `${uploadedAttachments.length} de ${selectedFiles.length} archivo(s) subido(s). El mensaje se enviará con los adjuntos disponibles.`,
                        variant: "destructive",
                    });
                } else {
                    toast({
                        title: "Archivos adjuntos subidos",
                        description: `${uploadedAttachments.length} archivo(s) subido(s) exitosamente.`,
                        variant: "default",
                    });
                }
            }

            const html = buildComposeMailHtml({
                recipientEmail,
                content: sanitizedContent,
                sender,
                uploadedAttachments,
            });

            const mailRef = doc(db, 'mail', mailId);
            const updateData: Record<string, unknown> = {
                'message.html': html,
                'message.content': sanitizedContent,
                'message.contentText': plainContent,
                'message.details': {
                    fecha: new Date().toLocaleDateString('es-ES'),
                    attachmentsCount: uploadedAttachments.length,
                },
            };

            if (uploadedAttachments.length > 0) {
                updateData.attachments = uploadedAttachments.map((file, index) => ({
                    id: `${mailId}_${index}`,
                    fileName: file.name,
                    fileUrl: file.url,
                    fileSize: file.size,
                    uploadedAt: file.uploadedAt,
                    hash: file.hash,
                    integrityCertificate: file.integrityCertificate,
                }));
                updateData.attachmentsHashes = uploadedAttachments.map((file) => file.hash);
            }

            await Promise.race([
                updateDoc(mailRef, updateData),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout al guardar el mensaje. Revisa tu conexión.')), 30_000)
                ),
            ]);

            let sendResult: SendEmailResult;
            try {
                sendResult = await sendEmailManually(mailId);
            } catch (sendErr: unknown) {
                const msg = sendErr instanceof Error ? sendErr.message : 'Error al enviar';
                toast({
                    title: "Error al enviar",
                    description: msg,
                    variant: "destructive",
                });
                return;
            }

            try {
                const creditOps = async () => {
                    const userRef = doc(db, 'users', user.uid);
                    await updateDoc(userRef, {
                        creditos: increment(-1),
                        updatedAt: new Date(),
                    });
                    await addDoc(collection(db, 'user_transactions'), {
                        userId: user.uid,
                        tipo: 'envio',
                        descripcion: `Envío de mensaje certificado a ${recipientEmail}`,
                        monto: 0,
                        creditos: -1,
                        metodoPago: 'Envíos',
                        fecha: new Date(),
                        mailId,
                    });
                };
                await Promise.race([
                    creditOps(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), 15_000)
                    ),
                ]);
            } catch (credErr) {
                console.error('Error al descontar envío:', credErr);
            }

            let toastDesc = 'Tu mensaje ha sido enviado y certificado en blockchain de Polygon.';
            if (uploadedAttachments.length > 0) {
                toastDesc += ` ${uploadedAttachments.length} archivo(s) adjunto(s) con hash de integridad.`;
            }
            if (phoneForWhatsApp && sendResult?.whatsappError) {
                toastDesc += ` WhatsApp: ${sendResult.whatsappError}`;
            }
            toast({
                title:
                    phoneForWhatsApp && sendResult?.whatsappError
                        ? 'Enviado (WhatsApp falló)'
                        : 'Mensaje Enviado y Certificado',
                description: toastDesc,
                variant: 'default',
            });
            onOpenChange(false);
            form.reset();
        } catch (e: unknown) {
            toast({
                title: "Error al enviar",
                description: e instanceof Error ? e.message : 'No se pudo enviar el mensaje',
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
    }, [isSuspended, toast, user, onOpenChange, form, selectedFiles]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Redactar Nuevo Mensaje Certificado</DialogTitle>
          <DialogDescription>
            Este mensaje será encriptado y certificado en la blockchain de Polygon.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <fieldset disabled={isSuspended}>
                <div className="grid gap-2">
                    <Label htmlFor="email-input">Correo del destinatario</Label>
                    <EmailAutocomplete
                        label=""
                        userId={user.uid}
                        value={form.watch('recipient')}
                        onChange={(v) => form.setValue('recipient', v, { shouldValidate: true })}
                        onBlur={() => form.trigger('recipient')}
                        onContactSelect={(c) => {
                            if (c.telefono) form.setValue('recipientPhone', c.telefono);
                        }}
                        error={form.formState.errors.recipient?.message}
                        placeholder="destinatario@ejemplo.com"
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
                        Si indicas un número, se puede enviar un mensaje por WhatsApp además del correo.
                    </p>
                    {form.formState.errors.recipientPhone && (
                        <p className="text-sm text-destructive">{form.formState.errors.recipientPhone.message}</p>
                    )}
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="content">Contenido del Mensaje</Label>
                    <RichTextEditor
                        value={form.watch("content")}
                        disabled={isSuspended || isSending}
                        onChange={(value) => {
                            form.setValue("content", value, {
                                shouldDirty: true,
                                shouldValidate: form.formState.isSubmitted,
                            });
                        }}
                        onBlur={() => form.trigger("content")}
                    />
                    <p className="text-xs text-muted-foreground">
                        Permite negrita, cursiva, subrayado, listas, citas, enlaces y alineación. Al pegar desde Word, Gmail o Google Docs se conserva el formato compatible.
                    </p>
                    {form.formState.errors.content && <p className="text-sm text-destructive">{form.formState.errors.content.message}</p>}
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
