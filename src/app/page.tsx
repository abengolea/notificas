import Link from 'next/link';
import { ShieldCheck, Mail, KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
             <ShieldCheck className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">BFA Certify</CardTitle>
          <CardDescription>Accede de forma segura a tus mensajes certificados</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="email" type="email" placeholder="nombre@ejemplo.com" required className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
                <div className="flex items-center">
                    <Label htmlFor="password">Contraseña</Label>
                    <Link href="#" className="ml-auto inline-block text-sm underline" prefetch={false}>
                        ¿Olvidaste tu contraseña?
                    </Link>
                </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="password" type="password" required className="pl-10" />
              </div>
            </div>
            <Button type="submit" className="w-full" asChild>
                <Link href="/dashboard">Iniciar Sesión</Link>
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            ¿No tienes una cuenta?{' '}
            <Link href="/signup" className="underline" prefetch={false}>
              Regístrate
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    