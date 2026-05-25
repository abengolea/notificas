"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Mail, 
  Eye, 
  CheckCircle, 
  Clock, 
  MapPin, 
  Monitor, 
  Globe,
  Hash,
  MessageCircle
} from 'lucide-react';
import { filterRecipientVisibleMovements } from '@/lib/tracking-movements';

interface Movement {
  id: string;
  type:
    | 'email_sent'
    | 'email_opened'
    | 'app_opened'
    | 'read_confirmed'
    | 'attachment_opened'
    | 'link_clicked'
    | 'whatsapp_link_clicked'
    | 'whatsapp_sent'
    | 'whatsapp_delivered'
    | 'whatsapp_read'
    | 'whatsapp_failed'
    | 'reader_magic_open';
  description: string;
  timestamp: any; // Firestore timestamp
  userAgent?: string;
  clientIP?: string;
  forwardedIPs?: string[];
  realIP?: string;
  browser?: string;
  recipientEmail?: string;
  /** Buzón al que iba dirigido el envío (preferir esto sobre recipientEmail para app_opened). */
  mailRecipientEmail?: string;
  openedByEmail?: string;
  /** True si fue el remitente quien solo abrió el detalle (no cuenta como lectura del destinatario). */
  viewerIsSender?: boolean;
  recipientPhone?: string;
  recipientPhoneVerified?: boolean;
}

interface MovementsTrackingProps {
  movements: Movement[];
  recipientEmail?: string | null;
}

const getMovementIcon = (type: string) => {
  switch (type) {
    case 'email_sent':
      return <Mail className="h-4 w-4 text-blue-500" />;
    case 'email_opened':
      return <Eye className="h-4 w-4 text-green-500" />;
    case 'read_confirmed':
      return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    case 'attachment_opened':
      return <Monitor className="h-4 w-4 text-purple-500" />;
    case 'link_clicked':
      return <Globe className="h-4 w-4 text-orange-500" />;
    case 'whatsapp_link_clicked':
    case 'whatsapp_sent':
    case 'whatsapp_delivered':
    case 'whatsapp_read':
    case 'whatsapp_failed':
      return <MessageCircle className="h-4 w-4 text-green-600" />;
    case 'app_opened':
    case 'reader_magic_open':
      return <Eye className="h-4 w-4 text-teal-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
};

const getMovementColor = (type: string) => {
  switch (type) {
    case 'email_sent':
      return 'bg-blue-100 text-blue-800';
    case 'email_opened':
      return 'bg-green-100 text-green-800';
    case 'read_confirmed':
      return 'bg-emerald-100 text-emerald-800';
    case 'attachment_opened':
      return 'bg-purple-100 text-purple-800';
    case 'link_clicked':
      return 'bg-orange-100 text-orange-800';
    case 'whatsapp_link_clicked':
    case 'whatsapp_sent':
    case 'whatsapp_delivered':
    case 'whatsapp_read':
    case 'whatsapp_failed':
      return 'bg-green-100 text-green-800 border border-green-300';
    case 'app_opened':
    case 'reader_magic_open':
      return 'bg-teal-100 text-teal-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const formatTimestamp = (timestamp: any) => {
  if (!timestamp) return 'Fecha no disponible';
  
  try {
    // Si es un objeto de Firestore timestamp
    if (timestamp.seconds) {
      return format(new Date(timestamp.seconds * 1000), 'dd/MM/yyyy HH:mm', { locale: es });
    }
    // Si es un string o Date
    return format(new Date(timestamp), 'dd/MM/yyyy HH:mm', { locale: es });
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return 'Fecha inválida';
  }
};

const formatIPs = (clientIP: string, forwardedIPs: string[], realIP: string) => {
  const ips = [clientIP, ...(forwardedIPs || []), realIP].filter(ip => ip && ip !== 'Unknown' && ip !== 'Server');
  return [...new Set(ips)].join(', '); // Remove duplicates
};

const READER_MAGIC_OPEN_DESCRIPTION =
  'El destinatario abrió el mensaje para leerlo (página web de la notificación)';

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  email_sent: 'CORREO ENVIADO',
  email_opened: 'CORREO ABIERTO',
  read_confirmed: 'LECTURA CONFIRMADA',
  attachment_opened: 'ARCHIVO ABIERTO',
  link_clicked: 'ENLACE PULSADO (CORREO)',
  whatsapp_link_clicked: 'CLIC EN WHATSAPP',
  whatsapp_sent: 'WHATSAPP ENVIADO',
  whatsapp_delivered: 'WHATSAPP ENTREGADO',
  whatsapp_read: 'WHATSAPP LEÍDO',
  whatsapp_failed: 'WHATSAPP NO ENTREGADO',
  reader_magic_open: 'NOTIFICACIÓN LEÍDA',
};

const MOVEMENT_TYPES_WITH_RECIPIENT_CONTEXT = new Set([
  'whatsapp_link_clicked',
  'whatsapp_sent',
  'whatsapp_delivered',
  'whatsapp_read',
  'whatsapp_failed',
  'link_clicked',
  'email_sent',
  'app_opened',
]);

function getMovementDescription(movement: Movement): string {
  if (movement.type === 'reader_magic_open') return READER_MAGIC_OPEN_DESCRIPTION;
  return movement.description;
}

function getMovementLabel(movement: Movement): string {
  if (movement.type === 'app_opened') {
    return movement.viewerIsSender
      ? 'VISITA DEL REMITENTE (DETALLE)'
      : 'APERTURA EN LA WEB (DESTINATARIO)';
  }
  return MOVEMENT_TYPE_LABELS[movement.type] || movement.type.replace(/_/g, ' ').toUpperCase();
}

function getBrowserLabel(browser: string): string {
  switch (browser) {
    case 'Unknown':
      return 'Desconocido';
    case 'WhatsApp Cloud API':
      return 'Sistema (WhatsApp de Meta)';
    default:
      return browser;
  }
}

function getRecipientPhoneLabel(type: string): string {
  return type === 'whatsapp_link_clicked'
    ? 'WhatsApp (enlace generado para):'
    : 'WhatsApp (teléfono del destinatario):';
}

export function MovementsTracking({ movements, recipientEmail }: MovementsTrackingProps) {
  const visibleMovements = filterRecipientVisibleMovements(movements, { recipientEmail });

  if (!visibleMovements.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Movimientos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No hay movimientos registrados para este mensaje.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sortedMovements = [...visibleMovements].sort((a, b) => {
    const timeA = a.timestamp?.seconds ? a.timestamp.seconds : new Date(a.timestamp).getTime() / 1000;
    const timeB = b.timestamp?.seconds ? b.timestamp.seconds : new Date(b.timestamp).getTime() / 1000;
    return timeB - timeA;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Movimientos ({visibleMovements.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedMovements.map((movement, index) => (
          <div key={movement.id}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                {getMovementIcon(movement.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">
                    {formatTimestamp(movement.timestamp)}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getMovementColor(movement.type)}`}
                  >
                    {getMovementLabel(movement)}
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground mb-2">
                  {getMovementDescription(movement)}
                </p>

                {MOVEMENT_TYPES_WITH_RECIPIENT_CONTEXT.has(movement.type) &&
                  (movement.recipientEmail ||
                    movement.mailRecipientEmail ||
                    movement.recipientPhone ||
                    movement.openedByEmail) && (
                    <div className="text-xs text-muted-foreground mb-2 space-y-0.5 border-l-2 border-border pl-2">
                      {(() => {
                        const destined =
                          (movement.mailRecipientEmail || '').trim() ||
                          (movement.recipientEmail || '').trim();
                        if (!destined || destined === 'Unknown') return null;
                        return (
                          <div>
                            <span className="text-foreground/80">Envío destinado a:</span>{' '}
                            <span className="font-mono">{destined}</span>
                          </div>
                        );
                      })()}
                      {movement.type === 'app_opened' && movement.openedByEmail && (
                        <div>
                          <span className="text-foreground/80">Quien accede al panel:</span>{' '}
                          <span className="font-mono">{movement.openedByEmail}</span>
                          {movement.viewerIsSender ? (
                            <span className="text-amber-800"> (remitente; no cuenta como lectura del destinatario)</span>
                          ) : null}
                        </div>
                      )}
                      {movement.type !== 'app_opened' &&
                        movement.recipientEmail &&
                        movement.recipientEmail !== 'Unknown' && (
                          <div>
                            <span className="text-foreground/80">Destinatario (contexto):</span>{' '}
                            <span className="font-mono">{movement.recipientEmail}</span>
                          </div>
                        )}
                      {movement.recipientPhone && (
                        <div>
                          <span className="text-foreground/80">{getRecipientPhoneLabel(movement.type)}</span>{' '}
                          <span className="font-mono">+{movement.recipientPhone}</span>
                          {movement.recipientPhoneVerified ? (
                            <span className="text-emerald-700"> · verificado</span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                
                {/* Información técnica simplificada */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    <span className="font-mono">{movement.id}</span>
                  </div>
                  
                  {movement.browser && movement.browser !== 'Server' && (
                    <div className="flex items-center gap-1">
                      <Monitor className="h-3 w-3" />
                      <span>
                        {getBrowserLabel(movement.browser)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {index < sortedMovements.length - 1 && (
              <Separator className="mt-4" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
