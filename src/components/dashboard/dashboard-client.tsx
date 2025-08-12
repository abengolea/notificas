
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Archive,
  ChevronRight,
  FileEdit,
  Inbox,
  LogOut,
  PenSquare,
  Search,
  Send,
  Trash2,
  User as UserIcon,
  Wallet,
  Menu,
  Mail,
  ReceiptText,
  MessageSquareReply,
  Megaphone,
  Scale,
  Gavel,
  AlertCircle,
} from 'lucide-react';

import type { User as AppUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { ComposeMessageDialog } from './compose-message-dialog';
import { UserNav } from './user-nav';
import { Logo } from '../logo';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

type Folder = "inbox" | "sent" | "drafts" | "archive" | "trash";
type MessageTypeFilter = "all" | "Comunicación" | "Notificación" | "Contestación" | "Oferta" | "Intimación" | "Oficio Judicial";

const messageTypeIcons: Record<string, React.ReactNode> = {
  "Comunicación": <Mail className="mr-2 h-4 w-4" />,
  "Notificación": <ReceiptText className="mr-2 h-4 w-4" />,
  "Contestación": <MessageSquareReply className="mr-2 h-4 w-4" />,
  "Oferta": <Megaphone className="mr-2 h-4 w-4" />,
  "Intimación": <Scale className="mr-2 h-4 w-4" />,
  "Oficio Judicial": <Gavel className="mr-2 h-4 w-4" />,
};

const FormattedDateCell = ({ date }: { date: Date | string }) => {
  const [formattedDate, setFormattedDate] = useState('');

  useEffect(() => {
    if (date) {
      setFormattedDate(format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: es }));
    }
  }, [date]);

  return <span>{formattedDate || 'Cargando...'}</span>;
};

// Adaptar Firebase Auth user al tipo de la app para reutilizar componentes
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
    creditos: 0,
  };
}

// Tipo simplificado para render de la tabla
type DisplayMessage = {
  id: string;
  sentAt: Date | string;
  from: string;
  to: string[];
  subject: string;
  lastStatus: string;
};

export default function DashboardClient() {
  const [isComposeOpen, setComposeOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<Folder>("inbox");
  const [activeFilter, setActiveFilter] = useState<MessageTypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAppUser(mapAuthUserToAppUser(u)));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!appUser?.email) return;

    const mailCol = collection(db, 'mail');
    let q;
    if (selectedFolder === 'inbox') {
      q = query(mailCol, where('to', 'array-contains', appUser.email), orderBy('delivery.time', 'desc'));
    } else if (selectedFolder === 'sent') {
      q = query(mailCol, where('from', '==', appUser.email), orderBy('delivery.time', 'desc'));
    } else {
      setMessages([]);
      return;
    }

    const unsub = onSnapshot(q, (snap) => {
      const items: DisplayMessage[] = snap.docs.map((d) => {
        const data = d.data() as any;
        const sentAt = data?.delivery?.time?.toDate?.() ? data.delivery.time.toDate() : new Date();
        const from = data?.from || 'contacto@notificas.com';
        const to = Array.isArray(data?.to) ? data.to : data?.to ? [data.to] : [];
        const subject = data?.message?.subject || 'Sin asunto';
        const opened = data?.tracking?.readConfirmed || data?.tracking?.opened;
        const lastStatus = opened ? 'Leído' : (data?.delivery?.state || 'PENDIENTE');
        return { id: d.id, sentAt, from, to, subject, lastStatus };
      });
      setMessages(items);
    });

    return () => unsub();
  }, [appUser?.email, selectedFolder]);

  const messageCountsByType = useMemo(() => {
    // Por ahora contamos todo como "Comunicación" para mantener UI
    const counts: Record<string, number> = {
      "Comunicación": messages.length,
      "Notificación": 0,
      "Contestación": 0,
      "Oferta": 0,
      "Intimación": 0,
      "Oficio Judicial": 0,
      "all": messages.length,
    };
    return counts;
  }, [messages]);

  const filteredMessages = useMemo(() => {
    let list = [...messages];

    if (activeFilter !== 'all') {
      // Actualmente todos mapean a Comunicación; cuando haya tipos reales, filtrar aquí
      list = activeFilter === 'Comunicación' ? list : [];
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((m) =>
        m.from.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q) ||
        m.to.join(', ').toLowerCase().includes(q)
      );
    }

    return list;
  }, [messages, activeFilter, searchQuery]);

  const folders: { id: Folder; label: string; icon: React.ReactNode }[] = [
    { id: 'inbox', label: 'Bandeja de Entrada', icon: <Inbox className="mr-3 h-5 w-5" /> },
    { id: 'sent', label: 'Enviados', icon: <Send className="mr-3 h-5 w-5" /> },
    { id: 'drafts', label: 'Borradores', icon: <FileEdit className="mr-3 h-5 w-5" /> },
    { id: 'archive', label: 'Archivo', icon: <Archive className="mr-3 h-5 w-5" /> },
    { id: 'trash', label: 'Papelera', icon: <Trash2 className="mr-3 h-5 w-5" /> },
  ];

  const isSuspended = appUser?.estado === 'suspendido';
  const totalNotifications = filteredMessages.length;

  const sidebarContent = (
    <>
      <div className="flex items-center justify-center h-20 border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <Logo className="h-12 w-auto" />
        </Link>
      </div>

      <div className="p-4">
        <ComposeMessageDialog open={isComposeOpen} onOpenChange={setComposeOpen} user={appUser as AppUser}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full">
                  <Button className="w-full h-12 text-base" onClick={() => setComposeOpen(true)} disabled={!!isSuspended}>
                    <PenSquare className="mr-2 h-5 w-5" />
                    NUEVO ENVÍO
                  </Button>
                </div>
              </TooltipTrigger>
              {isSuspended && (
                <TooltipContent>
                  <p>Tu cuenta está suspendida. Regulariza tu pago.</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </ComposeMessageDialog>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {folders.map((folder) => (
          <Button
            key={folder.id}
            variant={selectedFolder === folder.id ? 'secondary' : 'ghost'}
            className="w-full justify-start h-11 text-base"
            onClick={() => setSelectedFolder(folder.id)}
          >
            {folder.icon}
            {folder.label}
          </Button>
        ))}
      </nav>

      <div className="mt-auto p-6 space-y-6">
        <Separator />

        <div>
          <Link href="#" className="flex items-center text-base font-medium text-card-foreground/80 hover:text-primary">
            <UserIcon className="mr-3 h-5 w-5" />
            Mi Perfil
          </Link>
        </div>
        <div>
          <Link href="/login" className="flex items-center text-base font-medium text-card-foreground/80 hover:text-primary">
            <LogOut className="mr-3 h-5 w-5" />
            Cerrar sesión
          </Link>
        </div>

        <Separator />

        <div className="space-y-2">
          <Link href="/dashboard/billetera" className="flex items-center text-lg font-semibold hover:text-primary">
            <Wallet className="mr-2 h-6 w-6" />
            Billetera
          </Link>
          <div className="flex justify-between items-center text-sm p-3 bg-muted rounded-lg">
            <span>Créditos</span>
            <span className="font-bold text-lg text-primary">15</span>
          </div>
        </div>

        <div className="text-center">
          <a href="mailto:info@ucu.org.ar" className="text-sm text-muted-foreground hover:underline">info@ucu.org.ar</a>
        </div>
      </div>
    </>
  );

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
      <div className="hidden lg:block border-r">
        <div className="flex flex-col h-full bg-card text-card-foreground">
          {sidebarContent}
        </div>
      </div>
      <div className="flex flex-col bg-background">
        <header className="flex h-16 items-center gap-4 border-b bg-card px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Abrir menú</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0 w-full max-w-sm">
              <SheetHeader className="p-4 border-b">
                <SheetTitle>Menú</SheetTitle>
              </SheetHeader>
              {sidebarContent}
            </SheetContent>
          </Sheet>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">{folders.find((f) => f.id === selectedFolder)?.label}</h1>
          </div>
          {appUser && <UserNav user={appUser} />}
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {isSuspended && (
            <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700 dark:text-yellow-200">
                    Tu cuenta está suspendida debido a un problema con el pago. Puedes ver tus mensajes, pero no podrás enviar nuevos hasta que se resuelva.
                    {' '}
                    <Link href="/dashboard/billetera" className="font-medium underline hover:text-yellow-600 dark:hover:text-yellow-100">
                      Ir a la billetera para solucionarlo.
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <h1 className="text-2xl font-semibold">
              {folders.find((f) => f.id === selectedFolder)?.label} <span className="text-muted-foreground">(Notificaciones Recientes)</span>
            </h1>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Que desea buscar"
              className="pl-10 h-12 text-base rounded-full shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Total de Notificaciones: {totalNotifications}</p>
            <div className="flex flex-wrap gap-2">
              <h3 className="text-lg font-semibold mr-4 self-center">Tipos</h3>
              <Button
                variant={activeFilter === 'all' ? 'default' : 'outline'}
                className="rounded-full"
                onClick={() => setActiveFilter('all')}
              >
                Todos
                <Badge variant="secondary" className="ml-2">{messageCountsByType.all}</Badge>
              </Button>
              {Object.entries(messageCountsByType).map(([type, count]) => {
                if (type === 'all' || count === 0) return null;
                return (
                  <Button key={type} variant={activeFilter === type ? 'default' : 'outline'} className="rounded-full" onClick={() => setActiveFilter(type as MessageTypeFilter)}>
                    {messageTypeIcons[type as keyof typeof messageTypeIcons]}
                    {type}
                    <Badge variant="secondary" className="ml-2">{count}</Badge>
                  </Button>
                );
              })}
            </div>
          </div>

          <Card className="shadow-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha enviado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Emisor</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Ult. estado</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMessages.map((message) => {
                  const messageType = 'Comunicación';
                  return (
                    <TableRow key={message.id} className="cursor-pointer">
                      <TableCell>
                        <Link href={`/dashboard/mensaje/${message.id}`} className="block w-full h-full">
                          <FormattedDateCell date={message.sentAt} />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/mensaje/${message.id}`} className="block w-full h-full">
                          {messageType}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/dashboard/mensaje/${message.id}`} className="block w-full h-full text-primary hover:underline">
                          {message.from}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/mensaje/${message.id}`} className="block w-full h-full">
                          {message.to.join(', ')}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/mensaje/${message.id}`} className="block w-full h-full">
                          {message.subject}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/mensaje/${message.id}`} className="block w-full h-full">
                          {message.lastStatus}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/mensaje/${message.id}`}>Ver Detalles</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>Archivar</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Eliminar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </main>
      </div>
    </div>
  );
}
