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
import {
  MOVEMENT_TYPE_LABELS,
  clickSourceOriginLabel,
  inferClickSourceFromMovements,
  linkClickOriginLabel,
  movementChannel,
  movementChannelLabel,
  publicLinkClickDescription,
  publicMovementBrowserLabel,
  publicMovementDescription,
  readerOpenDescription,
  readerOpenLabel,
  type ClickSource,
  type MovementChannel,
} from '@/lib/movement-display';

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
    | 'reader_magic_open'
    | 'resend_sent'
    | 'resend_delivered'
    | 'resend_delayed'
    | 'resend_bounced'
    | 'resend_failed'
    | 'resend_suppressed'
    | 'resend_complained'
    | 'resend_opened_signal'
    | 'resend_clicked_signal';
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
  source?: string;
  clickSource?: string;
}

interface MovementsTrackingProps {
  movements: Movement[];
  recipientEmail?: string | null;
}

const CHANNEL_TONE = {
  whatsapp: {
    row: 'rounded-md border-l-4 border-green-500 bg-sky-50 px-3 py-2.5',
    chip: 'bg-green-100 text-green-800 border-green-300',
    icon: 'text-green-600',
    context: 'border-green-300',
  },
  other: {
    row: 'rounded-md border-l-4 border-sky-400 bg-sky-50 px-3 py-2.5',
    chip: 'bg-sky-100 text-sky-800 border-sky-300',
    icon: 'text-sky-600',
    context: 'border-sky-300',
  },
} as const;

function movementTone(channel: MovementChannel) {
  return channel === 'whatsapp' ? CHANNEL_TONE.whatsapp : CHANNEL_TONE.other;
}

const getMovementIcon = (type: string, iconClass: string) => {
  switch (type) {
    case 'email_sent':
    case 'resend_sent':
      return <Mail className={`h-4 w-4 ${iconClass}`} />;
    case 'resend_delivered':
    case 'read_confirmed':
      return <CheckCircle className={`h-4 w-4 ${iconClass}`} />;
    case 'resend_delayed':
    case 'resend_bounced':
    case 'resend_failed':
    case 'resend_suppressed':
    case 'resend_complained':
      return <Clock className={`h-4 w-4 ${iconClass}`} />;
    case 'resend_opened_signal':
    case 'resend_clicked_signal':
    case 'email_opened':
    case 'app_opened':
    case 'reader_magic_open':
      return <Eye className={`h-4 w-4 ${iconClass}`} />;
    case 'attachment_opened':
      return <Monitor className={`h-4 w-4 ${iconClass}`} />;
    case 'link_clicked':
      return <Globe className={`h-4 w-4 ${iconClass}`} />;
    case 'whatsapp_link_clicked':
    case 'whatsapp_sent':
    case 'whatsapp_delivered':
    case 'whatsapp_read':
    case 'whatsapp_failed':
      return <MessageCircle className={`h-4 w-4 ${iconClass}`} />;
    default:
      return <Clock className={`h-4 w-4 ${iconClass}`} />;
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

const MOVEMENT_TYPES_WITH_RECIPIENT_CONTEXT = new Set([
  'whatsapp_link_clicked',
  'whatsapp_sent',
  'whatsapp_delivered',
  'whatsapp_read',
  'whatsapp_failed',
  'link_clicked',
  'email_sent',
  'resend_sent',
  'resend_delivered',
  'resend_delayed',
  'resend_bounced',
  'resend_failed',
  'resend_suppressed',
  'resend_complained',
  'app_opened',
]);

function resolveMovementClickSource(movement: Movement, allMovements: Movement[]): ClickSource {
  return inferClickSourceFromMovements(movement, allMovements);
}

function getMovementChannelChip(movement: Movement, allMovements: Movement[]): MovementChannel {
  if (movement.type === 'reader_magic_open') {
    const clickSource = resolveMovementClickSource(movement, allMovements);
    if (clickSource === 'correo') return 'correo';
    if (clickSource === 'whatsapp') return 'whatsapp';
  }
  return movementChannel(movement.type);
}

function getMovementDescription(movement: Movement, allMovements: Movement[]): string {
  if (movement.type === 'reader_magic_open') {
    const clickSource = resolveMovementClickSource(movement, allMovements);
    const stored = publicMovementDescription(String(movement.description || ''));
    if (
      stored &&
      !/pudo llegar desde el correo o desde whatsapp/i.test(stored) &&
      !/página web de la notificación/i.test(stored)
    ) {
      return stored;
    }
    return readerOpenDescription(clickSource);
  }
  if (movement.type === 'whatsapp_link_clicked' || movement.type === 'link_clicked') {
    return publicLinkClickDescription(movement.type, String(movement.description || ''));
  }
  return publicMovementDescription(String(movement.description || ''));
}

function getMovementLabel(movement: Movement, allMovements: Movement[]): string {
  if (movement.type === 'app_opened') {
    return movement.viewerIsSender
      ? 'VISITA DEL REMITENTE (DETALLE)'
      : 'APERTURA EN LA WEB (DESTINATARIO)';
  }
  if (movement.type === 'reader_magic_open') {
    return readerOpenLabel(resolveMovementClickSource(movement, allMovements));
  }
  return MOVEMENT_TYPE_LABELS[movement.type] || movement.type.replace(/_/g, ' ').toUpperCase();
}

function getBrowserLabel(browser: string): string {
  return publicMovementBrowserLabel(browser);
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
        {sortedMovements.map((movement, index) => {
          const channel = getMovementChannelChip(movement, sortedMovements);
          const tone = movementTone(channel);
          const linkOrigin =
            linkClickOriginLabel(movement.type) ||
            (movement.type === 'reader_magic_open'
              ? clickSourceOriginLabel(resolveMovementClickSource(movement, sortedMovements))
              : null);
          return (
          <div key={movement.id}>
            <div className={`flex items-start gap-3 ${tone.row}`}>
              <div className="flex-shrink-0 mt-1">
                {getMovementIcon(movement.type, tone.icon)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-sm font-medium">
                    {formatTimestamp(movement.timestamp)}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${tone.chip}`}
                  >
                    {movementChannelLabel(channel)}
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${tone.chip}`}
                  >
                    {getMovementLabel(movement, sortedMovements)}
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground mb-2">
                  {getMovementDescription(movement, sortedMovements)}
                </p>

                {(linkOrigin ||
                  (MOVEMENT_TYPES_WITH_RECIPIENT_CONTEXT.has(movement.type) &&
                    (movement.recipientEmail ||
                      movement.mailRecipientEmail ||
                      movement.recipientPhone ||
                      movement.openedByEmail))) && (
                    <div className={`text-xs text-muted-foreground mb-2 space-y-0.5 border-l-2 pl-2 ${tone.context}`}>
                      {linkOrigin ? (
                        <div>
                          <span className="text-foreground/80">
                            {movement.type === 'reader_magic_open' ? 'Origen de la apertura:' : 'Origen del enlace:'}
                          </span>{' '}
                          <span className="font-medium text-foreground">{linkOrigin}</span>
                        </div>
                      ) : null}
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
                  
                  {movement.browser && getBrowserLabel(movement.browser) && (
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
          );
        })}
      </CardContent>
    </Card>
  );
}
