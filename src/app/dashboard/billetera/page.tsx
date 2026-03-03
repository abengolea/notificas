'use client';

import { UserNav } from '@/components/dashboard/user-nav';
import WalletClient from '@/components/dashboard/wallet-client';
import { Logo } from '@/components/logo';
import { mockTransactions, mockUser } from '@/lib/mock-data';
import { getPlans } from '@/lib/plans';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import type { User as AppUser, Plan, Transaccion } from '@/lib/types';

// Adaptar Firebase Auth user al tipo de la app
function mapAuthUserToAppUser(u: any | null): AppUser | null {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email || '',
    tipo: 'individual',
    estado: 'activo',
    perfil: {
      nombre: u.displayName || u.email || 'Usuario',
      verificado: true,
    },
    createdAt: new Date(),
    lastLogin: new Date(),
    avatarUrl: u.photoURL || undefined,
    creditos: 0, // Se cargará desde Firestore
  };
}

export default function BilleteraPage() {
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [planes, setPlanes] = useState<Plan[]>([]);
    const [transactions, setTransactions] = useState<Transaccion[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setAppUser(mapAuthUserToAppUser(u)));
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!appUser?.uid) return;

        // Cargar planes
        getPlans().then(setPlanes);

        // Cargar datos reales del usuario desde Firestore
        const loadUserData = async () => {
            try {
                const userRef = doc(db, 'users', appUser.uid);
                const userDoc = await getDoc(userRef);
                
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setAppUser(prev => prev ? {
                        ...prev,
                        creditos: userData.creditos || 0,
                        perfil: {
                            ...prev.perfil,
                            nombre: userData.perfil?.nombre || prev.perfil.nombre,
                            telefono: userData.perfil?.telefono,
                            cuit: userData.perfil?.cuit,
                            verificado: userData.perfil?.verificado || false
                        }
                    } : prev);
                }
            } catch (error) {
                console.error('Error cargando datos del usuario:', error);
            }
        };

        loadUserData();

        // Cargar transacciones del usuario
        const transactionsRef = collection(db, 'user_transactions');
        const q = query(
            transactionsRef,
            where('userId', '==', appUser.uid)
        );

        const unsub = onSnapshot(q, (snap) => {
            const userTransactions: Transaccion[] = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                fecha: doc.data().fecha?.toDate() || new Date()
            } as Transaccion));
            
            // Ordenar localmente por fecha
            userTransactions.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
            
            setTransactions(userTransactions);
            setLoading(false);
        }, (error) => {
            console.error('Error cargando transacciones:', error);
            setTransactions([]);
            setLoading(false);
        });

        return () => unsub();
    }, [appUser?.uid]);

    if (loading) {
        return (
            <div className="flex min-h-screen w-full flex-col bg-muted/40">
                <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-6">
                    <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                        <Logo className="h-8 w-auto" />
                        <span className="font-bold">Notificas</span>
                    </Link>
                </header>
                <main className="flex-1 p-4 sm:p-6 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p>Cargando billetera...</p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
            <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-6">
                <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                    <Logo className="h-8 w-auto" />
                    <span className="font-bold">Notificas</span>
                </Link>
                <div className="flex w-full flex-1 items-center justify-end gap-3">
                    <Button asChild variant="outline">
                        <Link href="/dashboard">
                            Volver al Dashboard
                        </Link>
                    </Button>
                    {appUser ? <UserNav user={appUser} /> : null}
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6">
                <WalletClient 
                    user={appUser || mockUser} 
                    transactions={transactions}
                    planes={planes}
                />
            </main>
        </div>
    );
}
