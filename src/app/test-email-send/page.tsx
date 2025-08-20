'use client';

import { useState } from 'react';
import { sendNotificationEmail } from '../../lib/email';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useToast } from '../../hooks/use-toast';

export default function TestEmailSendPage() {
  const [loading, setLoading] = useState(false);
  const [emailId, setEmailId] = useState<string>('');
  const [formData, setFormData] = useState({
    recipientEmail: 'test@example.com',
    recipientName: 'Usuario de Prueba',
    senderName: 'Empresa ABC',
    subject: 'Notificación de prueba',
    message: 'Este es un mensaje de prueba con contenido real que se mostrará en el lector.'
  });
  
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const id = await sendNotificationEmail({
        to: formData.recipientEmail,
        senderName: formData.senderName,
        recipientName: formData.recipientName,
        recipientEmail: formData.recipientEmail,
        subject: formData.subject
      });
      
      setEmailId(id);
      toast({
        title: "Email programado exitosamente",
        description: `ID del ticket: ${id}`,
      });
      
      // Limpiar formulario
      setFormData({
        recipientEmail: 'test@example.com',
        recipientName: 'Usuario de Prueba',
        senderName: 'Empresa ABC',
        subject: 'Notificación de prueba'
      });
      
    } catch (error) {
      console.error('Error enviando email:', error);
      toast({
        title: "Error al programar email",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Prueba de Envío de Emails</h1>
        <p className="text-gray-600">
          Esta página te permite probar el sistema de envío de emails y generar tickets 
          que aparecerán en la administración.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enviar Email de Prueba</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="senderName">Nombre del Remitente</Label>
              <Input
                id="senderName"
                value={formData.senderName}
                onChange={(e) => setFormData(prev => ({ ...prev, senderName: e.target.value }))}
                placeholder="Tu Empresa"
                required
              />
            </div>

            <div>
              <Label htmlFor="recipientName">Nombre del Destinatario</Label>
              <Input
                id="recipientName"
                value={formData.recipientName}
                onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
                placeholder="Juan Pérez"
                required
              />
            </div>

            <div>
              <Label htmlFor="recipientEmail">Email del Destinatario</Label>
              <Input
                id="recipientEmail"
                type="email"
                value={formData.recipientEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, recipientEmail: e.target.value }))}
                placeholder="juan.perez@email.com"
                required
              />
            </div>

            <div>
              <Label htmlFor="message">Mensaje</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Escribe tu mensaje aquí..."
                rows={4}
                required
              />
            </div>

            <div>
              <Label htmlFor="subject">Asunto del Email</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Notificación importante"
                required
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Enviando...' : 'Enviar Email de Prueba'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {emailId && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Email Programado Exitosamente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">ID del Ticket:</Label>
                <p className="font-mono text-sm bg-gray-100 p-2 rounded mt-1">{emailId}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Estado:</Label>
                <p className="text-green-600 font-medium mt-1">✅ Programado para envío</p>
              </div>
              
              <div className="pt-3">
                <p className="text-sm text-gray-600 mb-3">
                  El email ha sido programado y aparecerá en la administración de tickets. 
                  Se enviará automáticamente en unos segundos.
                </p>
                
                <div className="flex gap-2">
                  <Button variant="outline" asChild>
                    <a href="/admin/tickets" target="_blank">
                      Ver en Administración
                    </a>
                  </Button>
                  
                  <Button variant="outline" onClick={() => setEmailId('')}>
                    Enviar Otro
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>¿Cómo Funciona?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <p>Al hacer clic en "Enviar", se crea un documento en Firestore (colección 'mail')</p>
          </div>
          
          <div className="flex items-start gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <p>Firebase Functions detecta el nuevo documento y procesa el email automáticamente</p>
          </div>
          
          <div className="flex items-start gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <p>El email se envía via SMTP usando el template personalizado con tracking</p>
          </div>
          
          <div className="flex items-start gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">4</span>
            <p>Puedes ver el estado en <strong>/admin/tickets</strong> y monitorear aperturas/clicks</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
