'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function ProcessPaymentPage() {
  const [paymentId, setPaymentId] = useState('');
  const [userId, setUserId] = useState('NpUO7WquNXbLVs4yZG4ZCtuI5nw2'); // Tu user ID
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleProcessPayment = async () => {
    if (!paymentId) {
      toast({
        title: "Error",
        description: "Ingresa el Payment ID",
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/process-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId,
          userId
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "¡Éxito!",
          description: `Pago procesado. Se agregaron ${data.creditsAdded} créditos.`,
          variant: 'default',
        });
        setPaymentId('');
      } else {
        toast({
          title: "Error",
          description: data.error || 'Error procesando el pago',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Procesar Pago Manual</CardTitle>
          <CardDescription>
            Ingresa el Payment ID de Mercado Pago para procesar el pago y agregar créditos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Payment ID:</label>
            <Input
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
              placeholder="Ej: 125180646383"
            />
          </div>
          <div>
            <label className="text-sm font-medium">User ID:</label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="User ID"
            />
          </div>
          <Button 
            onClick={handleProcessPayment} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Procesando...' : 'Procesar Pago'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

