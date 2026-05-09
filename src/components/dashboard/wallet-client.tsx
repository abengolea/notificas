
"use client";

import { useState, useEffect } from 'react';
import type { User, Transaccion, Plan } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Gift, Package, TrendingUp, CreditCard, Loader2, History, RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { clienteDescuentoLista, COLEGIO_NOMBRE_FALLBACK_CLIENT } from '@/lib/colegio-discount-client';
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
  const [colegioPct, setColegioPct] = useState(0);
  const [colegioEligible, setColegioEligible] = useState(false);
  const [colegioNombre, setColegioNombre] = useState(COLEGIO_NOMBRE_FALLBACK_CLIENT);
  const [colegioBannerLoading, setColegioBannerLoading] = useState(true);
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

  useEffect(() => {
    let cancelled = false;
    async function loadColegio() {
      if (!user?.email) {
        setColegioBannerLoading(false);
        setColegioEligible(false);
        setColegioPct(0);
        setColegioNombre(COLEGIO_NOMBRE_FALLBACK_CLIENT);
        return;
      }
      try {
        const u = auth.currentUser;
        if (!u) {
          setColegioBannerLoading(false);
          setColegioNombre(COLEGIO_NOMBRE_FALLBACK_CLIENT);
          return;
        }
        const token = await u.getIdToken();
        const res = await fetch('/api/user/colegio-discount', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        const nom =
          typeof j.nombreColegio === 'string' && j.nombreColegio.trim()
            ? j.nombreColegio.trim()
            : COLEGIO_NOMBRE_FALLBACK_CLIENT;
        if (res.ok) {
          setColegioEligible(Boolean(j.eligible));
          setColegioPct(typeof j.discountPercent === 'number' ? j.discountPercent : 0);
          setColegioNombre(nom);
        } else {
          setColegioEligible(false);
          setColegioPct(0);
          setColegioNombre(nom);
        }
      } catch {
        if (!cancelled) {
          setColegioEligible(false);
          setColegioPct(0);
          setColegioNombre(COLEGIO_NOMBRE_FALLBACK_CLIENT);
        }
      } finally {
        if (!cancelled) setColegioBannerLoading(false);
      }
    }
    void loadColegio();
    return () => {
      cancelled = true;
    };
  }, [user.email]);
  
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
    });
  };

  const handlePurchase = async (plan: Plan) => {
    setLoadingPlan(plan.id);

    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      if (!token) {
        throw new Error('Iniciá sesión para pagar.');
      }

      const response = await fetch('/api/mercadopago/preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: plan.id,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(
          typeof errBody?.error === 'string' ? errBody.error : 'Error al crear la preferencia de pago',
        );
      }

      const data = await response.json();

      setLoadingPlan(null);

      window.location.href = data.initPoint;
      
    } catch (error) {
      console.error('Error al procesar el pago:', error);
      setLoadingPlan(null);

      toast({
        title: "Error al procesar el pago",
        description:
          error instanceof Error
            ? error.message
            : "Hubo un problema al crear la preferencia de pago. Inténtalo de nuevo.",
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

  const sortedTx = [...transactions].sort(
    (a, b) => b.fecha.getTime() - a.fecha.getTime(),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Billetera</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Saldo siempre arriba; elegí una sección para comprar, ver movimientos o sincronizar un pago.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Créditos disponibles</p>
            <p className="text-4xl font-bold tabular-nums text-primary sm:text-5xl">{user.creditos}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Equivale a envíos certificados que podés usar. Sin vencimiento.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="comprar" className="w-full">
        <div className="sticky top-16 z-10 -mx-4 border-b bg-muted/30 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 sm:inline-flex sm:w-auto">
            <TabsTrigger value="comprar" className="gap-1.5 px-2 sm:px-3">
              <CreditCard className="hidden h-4 w-4 sm:inline" aria-hidden />
              <span className="text-xs sm:text-sm">Comprar</span>
            </TabsTrigger>
            <TabsTrigger value="movimientos" className="gap-1.5 px-2 sm:px-3">
              <History className="hidden h-4 w-4 sm:inline" aria-hidden />
              <span className="text-xs sm:text-sm">Historial</span>
            </TabsTrigger>
            <TabsTrigger value="sincronizar" className="gap-1.5 px-2 sm:px-3">
              <RefreshCw className="hidden h-4 w-4 sm:inline" aria-hidden />
              <span className="text-xs sm:text-sm">Sincronizar</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="comprar" className="mt-4 space-y-0 focus-visible:outline-none">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Comprar créditos</CardTitle>
              <CardDescription>
                Elegí un plan; el cobro es seguro con Mercado Pago.
              </CardDescription>
              {!colegioBannerLoading && colegioEligible && colegioPct > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                  <Badge variant="secondary" className="bg-primary/15 text-primary hover:bg-primary/20">
                    {colegioNombre}
                  </Badge>
                  <span className="text-muted-foreground">
                    Tu cuenta tiene un <strong className="text-foreground">{colegioPct}%</strong> de descuento sobre el
                    precio de lista en todos los planes.
                  </span>
                </div>
              ) : null}
              {!colegioBannerLoading && !colegioEligible ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  El descuento para matriculados de{' '}
                  <strong className="text-foreground">{colegioNombre}</strong> se reconoce si el correo de tu sesión está
                  en la nómina que carga el administrador.
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {planes.map((plan) => {
                const list = plan.precio;
                const effective =
                  colegioEligible && colegioPct > 0
                    ? clienteDescuentoLista(list, colegioPct)
                    : list;
                const showStrike = colegioEligible && colegioPct > 0 && effective < list;

                return (
                  <Card key={plan.id} className="flex flex-col text-center">
                    <CardHeader className="pb-2 pt-4">
                      <div className="mx-auto mb-2 w-fit rounded-full bg-primary/10 p-3">
                        {planIcons[plan.id as keyof typeof planIcons] ?? (
                          <Package className="h-7 w-7 text-primary sm:h-8 sm:w-8" />
                        )}
                      </div>
                      <CardTitle className="text-lg sm:text-xl">{plan.nombre}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 pb-2">
                      <p className="mb-2 text-2xl font-bold sm:text-3xl">
                        {showStrike ? (
                          <span className="inline-flex flex-col items-center gap-0.5 sm:inline-flex sm:flex-row sm:items-baseline sm:justify-center sm:gap-2">
                            <span className="text-base line-through text-muted-foreground font-semibold sm:text-lg">
                              {formatCurrency(list)}
                            </span>
                            <span>{formatCurrency(effective)}</span>
                          </span>
                        ) : (
                          formatCurrency(list)
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">{plan.descripcion}</p>
                    </CardContent>
                    <CardFooter className="flex flex-col pt-2">
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
                );
              })}
            </CardContent>
            <CardFooter className="flex-col items-start gap-2 border-t pt-6">
              <p className="text-xs text-muted-foreground">
                Al hacer clic en «Pagar con Mercado Pago», te redirigimos al checkout seguro para completar el pago.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span aria-hidden>🔒</span>
                <span>Pago seguro procesado por Mercado Pago</span>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="movimientos" className="mt-4 focus-visible:outline-none">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Historial de transacciones</CardTitle>
              <CardDescription>Compras y uso de créditos. Podés desplazarte dentro de la tabla si hay muchos movimientos.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="max-h-[min(65vh,560px)] overflow-auto rounded-md border sm:border-0">
                <Table>
                  <TableHeader className="sticky top-0 z-[1] bg-background shadow-[0_1px_0_hsl(var(--border))]">
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Créditos</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTx.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          Todavía no hay movimientos en tu cuenta.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedTx.map((tx) => (
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
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sincronizar" className="mt-4 focus-visible:outline-none">
          <Card className="border-dashed shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">¿Pagaste y no ves los créditos?</CardTitle>
              <CardDescription>
                Pegá el número de operación del comprobante de Mercado Pago (sin el numeral #). Tiene que ser la misma
                cuenta con la que hiciste la compra.
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
