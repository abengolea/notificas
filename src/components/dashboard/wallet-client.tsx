
"use client";

import { useState, useEffect } from 'react';
import type { User, Transaccion, Plan } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Gift, Package, TrendingUp, CreditCard, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { Input } from '@/components/ui/input';

interface WalletClientProps {
  user: User;
  transactions: Transaccion[];
  planes: Plan[];
}

const planIcons: Partial<Record<Plan['id'], React.ReactNode>> = {
    individual: <Gift className="h-8 w-8 text-primary" />,
    pack10: <Package className="h-8 w-8 text-primary" />,
    ilimitado: <TrendingUp className="h-8 w-8 text-primary" />,
}

const FormattedDateCell = ({ date }: { date: Date | string }) => {
    const [formattedDate, setFormattedDate] = useState('');
  
    useEffect(() => {
        if (date) {
            setFormattedDate(format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: es }));
        }
    }, [date]);
  
    return <span>{formattedDate || 'Cargando...'}</span>;
};

export default function WalletClient({ user, transactions, planes }: WalletClientProps) {
  const [loadingPlan, setLoadingPlan] = useState<Plan['id'] | null>(null);
  const [syncOpId, setSyncOpId] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;

    async function settleOrNotify() {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const paymentId = params.get('payment_id');
      const rawStatus =
        params.get('status') || params.get('collection_status');
      const status = rawStatus?.toLowerCase();
      const cleanPath = `${window.location.pathname}${window.location.hash}`;

      const approved = status === 'approved' || status === 'success';
      const pending = status === 'pending' || status === 'in_process';
      const failed =
        status === 'rejected' ||
        status === 'failure' ||
        status === 'cancelled';

      const shouldTrySettle =
        !!paymentId && (!rawStatus || approved);

      if (shouldTrySettle) {
        for (let i = 0; i < 25; i++) {
          if (cancelled) return;
          if (auth.currentUser) break;
          await new Promise((r) => setTimeout(r, 200));
        }

        if (auth.currentUser) {
          try {
            const token = await auth.currentUser.getIdToken();
            const res = await fetch('/api/process-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ paymentId }),
            });
            const data = await res.json();
            if (cancelled) return;
            if (res.ok) {
              toast({
                title: data.alreadySettled
                  ? 'Pago ya registrado'
                  : 'Créditos acreditados',
                description: data.alreadySettled
                  ? 'Este cobro ya había sumado créditos a tu cuenta.'
                  : `Se agregaron ${data.creditsAdded} créditos.`,
              });
            } else if (
              typeof data.error === 'string' &&
              data.error.includes('no aprobado')
            ) {
              toast({
                title: 'Pago en proceso',
                description:
                  'Mercado Pago todavía no marca el cobro como aprobado. Recargá la billetera en unos minutos.',
              });
            } else {
              toast({
                title: 'No se sincronizó el pago',
                description:
                  data.error ??
                  'Probá más tarde o escribínos con el número de operación de Mercado Pago.',
                variant: 'destructive',
              });
            }
          } catch {
            if (!cancelled) {
              toast({
                title: 'Error de conexión',
                description:
                  'No pudimos sincronizar el pago. Volvé a intentar desde la página o recargá.',
                variant: 'destructive',
              });
            }
          }
        } else if (!cancelled) {
          toast({
            title: 'Iniciá sesión',
            description:
              'Hay un cobro pendiente de sincronizar. Iniciá sesión para acreditar tus créditos.',
            variant: 'destructive',
          });
        }
      } else if (approved && !paymentId && !cancelled) {
        toast({
          title: 'Pago recibido',
          description:
            'Si los créditos no aparecen, esperá unos segundos o recargá la página.',
        });
      } else if (pending && !cancelled) {
        toast({
          title: 'Pago pendiente',
          description:
            'Tu pago está en proceso. Los créditos se verán cuando se apruebe.',
        });
      } else if (failed && !cancelled) {
        toast({
          title: 'Pago no completado',
          description:
            'Si ya pagaste por error, revisá el estado en Mercado Pago o escribínos.',
          variant: 'destructive',
        });
      }

      if (!cancelled) {
        window.history.replaceState({}, '', cleanPath);
      }
    }

    settleOrNotify();
    return () => {
      cancelled = true;
    };
  }, [toast]);
  
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
    });
  };

  const handlePurchase = async (plan: Plan) => {
    setLoadingPlan(plan.id);

    try {
      // Llamar a la API para crear preferencia de pago
      const response = await fetch('/api/mercadopago/preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: plan.id,
          userId: user.uid,
          userEmail: user.email
        })
      });

      if (!response.ok) {
        throw new Error('Error al crear la preferencia de pago');
      }

      const data = await response.json();
      
      setLoadingPlan(null);
      
      // Redirigir a Mercado Pago
      window.location.href = data.initPoint;
      
    } catch (error) {
      console.error('Error al procesar el pago:', error);
      setLoadingPlan(null);
      
      toast({
        title: "Error al procesar el pago",
        description: "Hubo un problema al crear la preferencia de pago. Inténtalo de nuevo.",
        variant: 'destructive',
      });
    }
  };

  const handleSyncOperation = async () => {
    const paymentId = syncOpId.replace(/\s+/g, '').replace(/\D/g, '');
    if (!paymentId) {
      toast({
        title: 'Número inválido',
        description:
          'Pegá el número de operación de Mercado Pago (solo los dígitos, por ejemplo 158096992744).',
        variant: 'destructive',
      });
      return;
    }

    const u = auth.currentUser;
    if (!u) {
      toast({
        title: 'Sesión',
        description: 'Iniciá sesión para sincronizar tu pago.',
        variant: 'destructive',
      });
      return;
    }

    setSyncLoading(true);
    try {
      const token = await u.getIdToken();
      const res = await fetch('/api/process-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paymentId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: data.alreadySettled ? 'Ya estaba cargado' : 'Listo',
          description: data.alreadySettled
            ? 'Este número de operación ya había acreditado tus créditos.'
            : `Se acreditaron ${data.creditsAdded} crédito(s).`,
        });
        setSyncOpId('');
      } else {
        toast({
          title: 'No se pudo aplicar',
          description:
            typeof data.error === 'string'
              ? data.error
              : 'Reintentá más tarde o contactá soporte con el número de operación.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error de red',
        description: 'Probá de nuevo en un momento.',
        variant: 'destructive',
      });
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billetera</h1>
        <p className="text-muted-foreground">Gestiona tus créditos y revisa tu historial de transacciones.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 flex flex-col justify-between shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Créditos Disponibles</CardTitle>
            <CardDescription>Esta es la cantidad de envíos certificados que puedes realizar.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-10">
            <div className="text-7xl font-bold text-primary">{user.creditos}</div>
          </CardContent>
          <CardFooter>
             <p className="text-xs text-muted-foreground">Los créditos no tienen vencimiento.</p>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader>
            <CardTitle>Comprar Créditos</CardTitle>
            <CardDescription>Selecciona un plan para recargar tus créditos. El pago se procesa de forma segura a través de Mercado Pago.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {planes.map((plan) => (
              <Card key={plan.id} className="flex flex-col text-center">
                 <CardHeader>
                    <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-2">
                        {planIcons[plan.id as keyof typeof planIcons] ?? (
                          <Package className="h-8 w-8 text-primary" />
                        )}
                    </div>
                    <CardTitle className="text-xl">{plan.nombre}</CardTitle>
                 </CardHeader>
                 <CardContent className="flex-1">
                    <p className="text-3xl font-bold mb-2">{formatCurrency(plan.precio)}</p>
                    <p className="text-sm text-muted-foreground">{plan.descripcion}</p>
                 </CardContent>
                 <CardFooter className="flex flex-col">
                    <Button className="w-full" onClick={() => handlePurchase(plan)} disabled={loadingPlan !== null}>
                      {loadingPlan === plan.id ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Procesando...
                        </>
                      ) : (
                        <>
                            <CreditCard className="mr-2 h-4 w-4" /> Pagar con Mercado Pago
                        </>
                      )}
                    </Button>
                 </CardFooter>
              </Card>
            ))}
          </CardContent>
            <CardFooter className='flex-col items-start gap-2'>
                 <p className="text-xs text-muted-foreground">
                   Al hacer clic en el botón Pagar con Mercado Pago, serás redirigido a la plataforma de pago segura para completar la transacción.
                 </p>
                 <div className="flex items-center gap-2 text-xs text-muted-foreground">
                   <span>🔒</span>
                   <span>Pago seguro procesado por Mercado Pago</span>
                 </div>
            </CardFooter>
        </Card>
      </div>

      <Card className="shadow-lg border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">¿Pagaste y no ves los créditos?</CardTitle>
          <CardDescription>
            Pegá el número de operación que figura en el comprobante de Mercado Pago (sin el numeral #).
            Tiene que ser la misma cuenta con la que iniciaste la compra.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label htmlFor="mp-op-id" className="text-sm font-medium">
              Número de operación
            </label>
            <Input
              id="mp-op-id"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ej: 158096992744"
              value={syncOpId}
              onChange={(e) => setSyncOpId(e.target.value)}
              disabled={syncLoading}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="sm:shrink-0"
            onClick={handleSyncOperation}
            disabled={syncLoading}
          >
            {syncLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando…
              </>
            ) : (
              'Sincronizar pago'
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Historial de Transacciones</CardTitle>
          <CardDescription>Aquí puedes ver todas tus compras y el uso de créditos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Créditos</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.sort((a,b) => b.fecha.getTime() - a.fecha.getTime()).map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    <FormattedDateCell date={tx.fecha} />
                  </TableCell>
                  <TableCell className="font-medium">{tx.descripcion}</TableCell>
                  <TableCell>
                    <Badge variant={tx.tipo === 'compra' ? 'default' : 'secondary'}>
                      {tx.tipo.charAt(0).toUpperCase() + tx.tipo.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className={`font-bold ${tx.tipo === 'compra' ? 'text-green-600' : 'text-destructive'}`}>
                    {tx.tipo === 'compra' ? `+${tx.creditos}` : tx.creditos}
                  </TableCell>
                  <TableCell className="text-right">
                    {tx.monto > 0 ? formatCurrency(tx.monto) : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
