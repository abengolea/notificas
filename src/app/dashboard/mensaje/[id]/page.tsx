
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { use, Suspense } from 'react';
import { mockMessages, mockUser } from '@/lib/mock-data';
import MessageView from '@/components/dashboard/message-view';
import { Button } from '@/components/ui/button';
import { UserNav } from '@/components/dashboard/user-nav';
import { Logo } from '@/components/logo';

// Componente wrapper para manejar el params de forma segura
function MessageContent({ params }: { params: any }) {
  let id: string;
  
  try {
    // Múltiples estrategias para obtener el ID
    if (typeof params === 'object' && params !== null) {
      if ('then' in params && typeof params.then === 'function') {
        // Es una Promise (Next.js 15)
        const { id: paramId } = use(params);
        id = paramId;
      } else if (params.id) {
        // Es un objeto directo (Next.js 14)
        id = params.id;
      } else {
        // Fallback: buscar en cualquier propiedad
        id = Object.values(params)[0] as string;
      }
    } else {
      // Último recurso: extraer de URL
      id = window?.location?.pathname?.split('/').pop() || '1';
    }
  } catch (error) {
    console.warn('Error accessing params, using fallback:', error);
    // Extrae el ID de la URL como último recurso
    if (typeof window !== 'undefined') {
      id = window.location.pathname.split('/').pop() || '1';
    } else {
      id = '1'; // Fallback final
    }
  }

  const message = mockMessages.find((m) => m.id === id);

  if (!message) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center text-center p-4">
        <h1 className="text-2xl font-bold">Mensaje no encontrado</h1>
        <p className="text-muted-foreground">El mensaje que estás buscando no existe o fue eliminado.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard">Volver al Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
            <div className='hidden lg:flex items-center gap-2'>
              <Logo className="h-10 w-auto" />
              <span className="font-bold text-xl">Notificas</span>
            </div>
            <div className="flex-1">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Volver</span>
                    </Link>
                </Button>
            </div>
            <UserNav user={mockUser} />
        </header>

        <main className="flex-1 p-4 md:p-8 lg:p-12">
            <div className="mx-auto max-w-4xl">
                 <MessageView message={message} currentUser={mockUser} />
            </div>
        </main>
    </div>
  );
}

export default function MessageDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Cargando mensaje...</p>
        </div>
      </div>
    }>
      <MessageContent params={params} />
    </Suspense>
  );
}
