
"use client";

import { useState, useEffect } from 'react';
import type { User, Transaccion, Plan } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DollarSign, Gift, Package, TrendingUp, CreditCard, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface WalletClientProps {
  user: User;
  transactions: Transaccion[];
  planes: Plan[];
}

const planIcons: Record<Plan['id'], React.ReactNode> = {
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
  const [showRedirectionAlert, setShowRedirectionAlert] = useState(false);
  const { toast } = useToast();
  
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
    });
  };

  const handlePurchase = async (plan: Plan) => {
    setLoadingPlan(plan.id);

    // Simula una llamada a la API del backend para crear una preferencia de pago
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setLoadingPlan(null);
    setShowRedirectionAlert(true);
    
    toast({
        title: "Preferencia de pago creada",
        description: `Serás redirigido a Mercado Pago para completar la compra del plan: ${plan.nombre}.`,
        variant: 'default',
    });
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
                        {planIcons[plan.id]}
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
                            <CreditCard className="mr-2 h-4 w-4" /> Comprar Ahora
                        </>
                      )}
                    </Button>
                 </CardFooter>
              </Card>
            ))}
          </CardContent>
            <CardFooter className='flex-col items-start gap-2'>
                 <p className="text-xs text-muted-foreground">Al hacer clic en "Comprar Ahora", serás redirigido a Mercado Pago para completar la transacción.</p>
                 <Image src="https://placehold.co/200x40.png" alt="Powered by Mercado Pago" width={150} height={30} data-ai-hint="logo mercadopago" />
            </CardFooter>
        </Card>
      </div>

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

        <AlertDialog open={showRedirectionAlert} onOpenChange={setShowRedirectionAlert}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Redirección a Mercado Pago</AlertDialogTitle>
                    <AlertDialogDescription>
                       En una aplicación real, serías redirigido a la pasarela de pago de Mercado Pago para completar tu compra de forma segura.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => setShowRedirectionAlert(false)}>Entendido</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
