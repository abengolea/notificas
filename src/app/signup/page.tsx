import Link from 'next/link';
import { Mail, KeyRound, User, Building, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Logo } from '@/components/logo';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-lg shadow-xl">
        <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
                <Logo className="h-16 w-16" />
            </div>
            <CardTitle className="text-3xl font-bold">Crear una Cuenta</CardTitle>
            <CardDescription>Únete a BFA Certify para enviar y recibir mensajes con validez legal.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="space-y-2">
                <Label>Tipo de Cuenta</Label>
                <RadioGroup defaultValue="individual" className="grid grid-cols-2 gap-4">
                    <div>
                        <RadioGroupItem value="individual" id="individual" className="peer sr-only" />
                        <Label
                        htmlFor="individual"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                        >
                        <User className="mb-3 h-6 w-6" />
                        Individual
                        </Label>
                    </div>
                    <div>
                        <RadioGroupItem value="empresa" id="empresa" className="peer sr-only" />
                        <Label
                        htmlFor="empresa"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                        >
                        <Building className="mb-3 h-6 w-6" />
                        Empresa
                        </Label>
                    </div>
                </RadioGroup>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="razonSocial">Nombre Completo / Razón Social</Label>
                    <Input id="razonSocial" placeholder="Juan Pérez o ExampleCorp S.A." required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cuit">DNI / CUIT</Label>
                    <Input id="cuit" placeholder="20-12345678-9" required />
                </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
               <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="email" type="email" placeholder="nombre@ejemplo.com" required className="pl-10" />
              </div>
            </div>

             <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
               <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="phone" type="tel" placeholder="+54 9 11 1234-5678" required className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="password" type="password" required className="pl-10" />
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">Al registrarte, aceptas nuestros Términos de Servicio y Política de Privacidad.</p>

            <Button type="submit" className="w-full" asChild>
                <Link href="/dashboard">Registrarse</Link>
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/" className="underline" prefetch={false}>
              Iniciar Sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
