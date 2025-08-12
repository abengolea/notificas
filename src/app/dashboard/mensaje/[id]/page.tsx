"use client";

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import MessageView from '@/components/dashboard/message-view';
import { Button } from '@/components/ui/button';
import { UserNav } from '@/components/dashboard/user-nav';
import { Logo } from '@/components/logo';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as AppUser } from '@/lib/types';

function mapAuthUserToAppUser(u: any | null): AppUser | null {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email || '',
    tipo: 'individual',
    estado: 'activo',
    perfil: { nombre: u.displayName || u.email || 'Usuario', verificado: true },
    createdAt: new Date(),
    lastLogin: new Date(),
    avatarUrl: u.photoURL || undefined,
    creditos: 0,
  };
}

function useParamId(params: any): string | null {
  try {
    if (typeof params === 'object' && params !== null) {
      // Next 15 streaming params
      if ('then' in params && typeof params.then === 'function') {
        // Not supported in client hook; fallback to URL
        if (typeof window !== 'undefined') {
          return window.location.pathname.split('/').pop() || null;
        }
        return null;
      }
      if (params.id) return params.id as string;
      const first = Object.values(params)[0];
      return typeof first === 'string' ? first : null;
    }
    if (typeof window !== 'undefined') {
      return window.location.pathname.split('/').pop() || null;
    }
    return null;
  } catch {
    if (typeof window !== 'undefined') {
      return window.location.pathname.split('/').pop() || null;
    }
    return null;
  }
}

function MessageContent({ params }: { params: any }) {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [messageData, setMessageData] = useState<any | null>(null);

  const id = useParamId(params);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAppUser(mapAuthUserToAppUser(u)));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const snap = await getDoc(doc(db, 'mail', id));
      if (!snap.exists()) {
        setNotFound(true);
        setMessageData(null);
        return;
      }
      const data = snap.data();
      setMessageData({ id, ...data });
    })();
  }, [id]);

  if (notFound) {
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

  if (!messageData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Cargando mensaje...</p>
        </div>
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
        {appUser ? <UserNav user={appUser} /> : null}
      </header>

      <main className="flex-1 p-4 md:p-8 lg:p-12">
        <div className="mx-auto max-w-4xl">
          <MessageView message={messageData} currentUser={appUser as AppUser} />
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
