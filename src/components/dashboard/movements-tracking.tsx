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
  Hash
} from 'lucide-react';

interface Movement {
  id: string;
  type: 'email_sent' | 'email_opened' | 'app_opened' | 'read_confirmed' | 'attachment_opened' | 'link_clicked';
  description: string;
  timestamp: any; // Firestore timestamp
  userAgent?: string;
  clientIP?: string;
  forwardedIPs?: string[];
  realIP?: string;
  browser?: string;
  recipientEmail?: string;
}

interface MovementsTrackingProps {
  movements: Movement[];
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
    case 'app_opened':
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
    case 'app_opened':
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

export function MovementsTracking({ movements }: MovementsTrackingProps) {
  if (!movements || movements.length === 0) {
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

  // Ordenar movimientos por timestamp (más recientes primero)
  const sortedMovements = [...movements].sort((a, b) => {
    const timeA = a.timestamp?.seconds ? a.timestamp.seconds : new Date(a.timestamp).getTime() / 1000;
    const timeB = b.timestamp?.seconds ? b.timestamp.seconds : new Date(b.timestamp).getTime() / 1000;
    return timeB - timeA;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Movimientos ({movements.length})
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
                    {movement.type === 'email_sent' && 'EMAIL ENVIADO'}
                    {movement.type === 'email_opened' && 'EMAIL ABIERTO'}
                    {movement.type === 'read_confirmed' && 'LECTURA CONFIRMADA'}
                    {movement.type === 'attachment_opened' && 'ARCHIVO ABIERTO'}
                    {movement.type === 'link_clicked' && 'ENLACE CLICKEADO'}
                    {movement.type === 'app_opened' && 'APP OPENED'}
                    {!['email_sent', 'email_opened', 'app_opened', 'read_confirmed', 'attachment_opened', 'link_clicked'].includes(movement.type) && movement.type.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground mb-2">
                  {movement.description}
                </p>
                
                {/* Información técnica simplificada */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    <span className="font-mono">{movement.id}</span>
                  </div>
                  
                  {movement.browser && movement.browser !== 'Server' && (
                    <div className="flex items-center gap-1">
                      <Monitor className="h-3 w-3" />
                      <span>{movement.browser}</span>
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
