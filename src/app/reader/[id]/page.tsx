"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, MousePointer, CheckCircle, Clock, Mail } from "lucide-react";

interface MailData {
  from?: string;
  to?: string;
  subject?: string;
  message?: {
    html?: string;
    subject?: string;
  };
  delivery?: {
    state: string;
    time: any;
    info?: string;
  };
  tracking?: {
    opened: boolean;
    openedAt: any;
    openCount: number;
    clickCount: number;
    readConfirmed: boolean;
    readConfirmedAt: any;
    sentAt: any;
  };
  createdAt?: any;
}

export default function ReaderPage() {
  const params = useParams();
  const [mail, setMail] = useState<MailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;

    const unsubscribe = onSnapshot(
      doc(db, 'mail', params.id as string),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data() as MailData;
          setMail(data);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching mail:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando mensaje...</p>
        </div>
      </div>
    );
  }

  if (!mail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Mail className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Mensaje no encontrado</h1>
          <p className="text-gray-600">El mensaje que buscas no existe o ha sido eliminado.</p>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'No disponible';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'SUCCESS': return 'bg-green-100 text-green-800';
      case 'ERROR': return 'bg-red-100 text-red-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header del mensaje */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl">
              Mensaje certificado de {mail.from}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <div><strong>De:</strong> {mail.from}</div>
            <div><strong>Para:</strong> {mail.to}</div>
            <div><strong>Asunto:</strong> {mail.message?.subject || 'Sin asunto'}</div>
            <div><strong>Fecha:</strong> {formatDate(mail.createdAt)}</div>
          </CardContent>
        </Card>

        {/* Estado del tracking en tiempo real */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Estado del Tracking en Tiempo Real
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Estado de entrega */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Estado de Entrega
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Estado:</span>
                    <Badge className={getStatusColor(mail.delivery?.state || 'PENDING')}>
                      {mail.delivery?.state || 'PENDIENTE'}
                    </Badge>
                  </div>
                  {mail.delivery?.time && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Enviado:</span>
                      <span className="text-sm font-medium">{formatDate(mail.delivery.time)}</span>
                    </div>
                  )}
                  {mail.delivery?.info && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">ID del mensaje:</span>
                      <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-xs">
                        {mail.delivery.info}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Métricas de tracking */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <MousePointer className="h-4 w-4" />
                  Métricas de Interacción
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Abierto:</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={mail.tracking?.opened ? "default" : "secondary"}>
                        {mail.tracking?.opened ? 'SÍ' : 'NO'}
                      </Badge>
                      {mail.tracking?.opened && (
                        <span className="text-xs text-gray-500">
                          {formatDate(mail.tracking.openedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Veces abierto:</span>
                    <Badge variant="outline" className="font-mono">
                      {mail.tracking?.openCount || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Clicks:</span>
                    <Badge variant="outline" className="font-mono">
                      {mail.tracking?.clickCount || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Lectura confirmada:</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={mail.tracking?.readConfirmed ? "default" : "secondary"}>
                        {mail.tracking?.readConfirmed ? 'SÍ' : 'NO'}
                      </Badge>
                      {mail.tracking?.readConfirmed && (
                        <span className="text-xs text-gray-500">
                          {formatDate(mail.tracking.readConfirmedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Información adicional */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">¿Cómo funciona el tracking?</p>
                  <ul className="space-y-1 text-xs">
                    <li>• <strong>Abierto:</strong> Se marca cuando abres este mensaje</li>
                    <li>• <strong>Clicks:</strong> Se incrementan cada vez que haces click en un enlace</li>
                    <li>• <strong>Lectura confirmada:</strong> Se marca cuando confirmas que has leído el mensaje</li>
                  </ul>
                  <p className="mt-2 text-xs opacity-75">
                    Todas las acciones se registran en tiempo real y quedan certificadas en la red Blockchain.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contenido del mensaje */}
        <Card>
          <CardHeader>
            <CardTitle>Contenido del Mensaje</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="prose max-w-none" 
              dangerouslySetInnerHTML={{ __html: mail?.message?.html || '' }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}