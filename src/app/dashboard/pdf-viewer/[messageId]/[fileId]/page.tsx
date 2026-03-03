"use client"

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PDFViewer } from '@/components/dashboard/pdf-viewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: Date;
  tracking?: any;
}

interface MessageData {
  from: string;
  to: string;
  subject: string;
  content: string;
  attachments: Attachment[];
  createdAt: any;
}

export default function PDFViewerPage() {
  const params = useParams();
  const messageId = params.messageId as string;
  const fileId = params.fileId as string;
  
  const [messageData, setMessageData] = useState<MessageData | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMessageData = async () => {
      try {
        setLoading(true);
        console.log('🔍 Buscando mensaje:', messageId);
        
        const messageRef = doc(db, 'mail', messageId);
        const messageDoc = await getDoc(messageRef);
        
        if (!messageDoc.exists()) {
          setError('Mensaje no encontrado');
          setLoading(false);
          return;
        }
        
        const data = messageDoc.data() as MessageData;
        setMessageData(data);
        
        // Encontrar el adjunto específico
        const foundAttachment = data.attachments?.find(att => att.id === fileId);
        if (!foundAttachment) {
          setError('Archivo adjunto no encontrado');
          setLoading(false);
          return;
        }
        
        setAttachment(foundAttachment);
        console.log('✅ Adjunto encontrado:', foundAttachment);
        
      } catch (err: any) {
        console.error('❌ Error al obtener datos del mensaje:', err);
        setError('Error al cargar el mensaje');
      } finally {
        setLoading(false);
      }
    };

    if (messageId && fileId) {
      fetchMessageData();
    }
  }, [messageId, fileId]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Cargando documento...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !attachment || !messageData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {error || 'No se pudo cargar el documento'}
            </p>
            <div className="flex gap-4">
              <Link href="/dashboard">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver al Dashboard
                </Button>
              </Link>
              <Link href={`/dashboard/mensaje/${messageId}`}>
                <Button>
                  <FileText className="h-4 w-4 mr-2" />
                  Ver Mensaje
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header con navegación */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Visor de PDF</h1>
            <p className="text-muted-foreground">
              Mensaje: {messageData.subject}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/dashboard/mensaje/${messageId}`}>
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al Mensaje
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
        
        {/* Información del mensaje */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Información del Mensaje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">De:</span>
                <p className="font-medium">{messageData.from}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Para:</span>
                <p className="font-medium">{messageData.to}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Fecha:</span>
                <p className="font-medium">
                  {messageData.createdAt?.toDate?.()?.toLocaleDateString('es-ES') || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visor de PDF con tracking */}
      <PDFViewer
        messageId={messageId}
        attachmentId={attachment.id}
        fileName={attachment.name}
        fileUrl={attachment.url}
        fileSize={attachment.size}
      />
    </div>
  );
}
