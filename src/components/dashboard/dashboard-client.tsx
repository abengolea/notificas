
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
  Settings,
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
  Users,
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
import { ContactosPageComponent } from './contactos-page';
import { MovementsTracking } from './movements-tracking';
import { Logo } from '../logo';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, limit, getDoc, doc } from 'firebase/firestore';

type Folder = "inbox" | "sent" | "drafts" | "archive" | "trash" | "contactos";
type MessageTypeFilter = "all" | "Comunicación" | "Notificación" | "Contestación" | "Oferta" | "Intimación" | "Oficio Judicial";
type SourceFilter = "all" | "app_web" | "external_email";

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
  mailId?: string;
  sentAt: Date | string;
  from: string;
  to: string[];
  subject: string;
  lastStatus: string;
  source?: string;
  sourceLabel?: string;
  sourceIcon?: string;
  movements?: any[];
};

export default function DashboardClient() {
  const [isComposeOpen, setComposeOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<Folder>("inbox");
  const [activeFilter, setActiveFilter] = useState<MessageTypeFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [showCleanupButton, setShowCleanupButton] = useState(false);

  // Función para detectar mensajes duplicados
  const detectDuplicates = (messages: DisplayMessage[]) => {
    const duplicates = messages.filter(msg => 
      msg.subject.includes('Mensaje certificado de abengolea1@gmail.com') ||
      msg.subject === 'Mensaje de prueba desde la app' ||
      !msg.from
    );
    setShowCleanupButton(duplicates.length > 0);
    return duplicates;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAppUser(mapAuthUserToAppUser(u)));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!appUser?.uid) return;

    const userRef = doc(db, 'users', appUser.uid);

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (!snapshot.exists()) return;

        const userData = snapshot.data() as any;

        setAppUser((prev) => {
          if (!prev) return prev;

          return {
            ...prev,
            tipo: userData?.tipo || prev.tipo,
            estado: userData?.estado || prev.estado,
            creditos: typeof userData?.creditos === 'number' ? userData.creditos : prev.creditos,
            perfil: {
              ...prev.perfil,
              ...(userData?.perfil || {}),
              verificado: userData?.perfil?.verificado ?? prev.perfil.verificado,
            },
          };
        });
      },
      (error) => {
        console.error('Error cargando datos del usuario:', error);
      }
    );

    return () => unsubscribe();
  }, [appUser?.uid]);

  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`🔥🔥🔥 NUEVO USEEFFECT EJECUTADO 🔥🔥🔥`);
    console.log(`🔄 [${timestamp}] useEffect ejecutado para folder:`, selectedFolder, 'user:', appUser?.email);
    console.log('🔐 User auth state:', { 
      user: appUser, 
      email: appUser?.email,
      selectedFolder 
    });
    
    if (!appUser?.email) return;

    // Consultar solo la colección 'mail' - fuente única de verdad
    const mailCol = collection(db, 'mail');
    let q;
    if (selectedFolder === 'inbox') {
      // Bandeja de entrada: mensajes donde el usuario es destinatario
      q = query(mailCol, where('to', 'array-contains', appUser.email));
    } else if (selectedFolder === 'sent') {
      // Enviados: mensajes donde el usuario es remitente
      q = query(mailCol, where('senderName', '==', appUser.email));
    } else if (selectedFolder === 'contactos') {
      // Para contactos, no cargar mensajes - se maneja en la página separada
      setMessages([]);
      return;
    } else {
      // Para otras carpetas (drafts, archive, trash) - por ahora vacío
      setMessages([]);
      return;
    }

    console.log(`📡 [${timestamp}] Creando onSnapshot listener para folder:`, selectedFolder);
    
    // Contador de listeners para debug
    let listenerCallCount = 0;
    let lastProcessedData = '';
    
    const unsub = onSnapshot(q, (snap) => {
      listenerCallCount++;
      const listenerTimestamp = new Date().toISOString();
      
      // Crear un hash de los datos para detectar duplicados
      const dataHash = JSON.stringify({
        totalDocs: snap.docs.length,
        docIds: snap.docs.map(d => d.id).sort(),
        changes: snap.docChanges().map(change => ({ type: change.type, docId: change.doc.id }))
      });
      
      console.log(`🔥🔥🔥 NUEVO LISTENER EJECUTADO #${listenerCallCount} 🔥🔥🔥`);
      console.log(`📊 [${listenerTimestamp}] Query results (call #${listenerCallCount}):`, {
        folder: selectedFolder,
        userEmail: appUser.email,
        totalDocs: snap.docs.length,
        hasChanges: snap.docChanges().length,
        changes: snap.docChanges().map(change => ({ type: change.type, docId: change.doc.id })),
        isDuplicate: dataHash === lastProcessedData
      });
      
      // Si los datos son idénticos, no procesar
      if (dataHash === lastProcessedData) {
        console.log('⚠️⚠️⚠️ DATOS DUPLICADOS DETECTADOS, SALTANDO PROCESAMIENTO ⚠️⚠️⚠️');
        return;
      }
      
      lastProcessedData = dataHash;
      
      const items: DisplayMessage[] = snap.docs
        .map((d, index) => {
          const data = d.data() as any;
          
          // Debug: solo mostrar los primeros 3 correos para evitar spam en logs
          if (process.env.NODE_ENV === 'development' && index < 3) {
            console.log('Message data for ID:', d.id, {
              from: data?.from,
              to: data?.to,
              subject: data?.message?.subject,
              timestamp: data?.timestamp
            });
          }
          
          // Usar timestamp real del documento
          const sentAt = data?.delivery?.time?.toDate?.() || 
                        data?.tracking?.sentAt?.toDate?.() ||
                        data?.createdAt?.toDate?.() || 
                        new Date();
          const from = data?.from || 'contacto@notificas.com';
          const to = Array.isArray(data?.to) ? data.to : data?.to ? [data.to] : [];
          const subject = data?.message?.subject || 'Sin asunto';
          
          // Usar movimientos como fuente de verdad para el estado
          const movements = data?.tracking?.movements || [];
          const emailSentCount = movements.filter((m: any) => m.type === 'email_sent').length;
          const emailOpenedCount = movements.filter((m: any) => m.type === 'email_opened').length;
          const appOpenedCount = movements.filter((m: any) => m.type === 'app_opened').length;
          const readConfirmedCount = movements.filter((m: any) => m.type === 'read_confirmed').length;
          
          // Lógica de estados basada en movimientos: Leído > Abierto (email o app) > Entregado > Pendiente
          let lastStatus;
          if (readConfirmedCount > 0) {
            lastStatus = 'Leído';
          } else if (emailOpenedCount > 0 || appOpenedCount > 0) {
            lastStatus = 'Abierto';
          } else if (emailSentCount > 0) {
            lastStatus = 'Entregado';
          } else {
            lastStatus = 'Pendiente';
          }
          
          return { 
            id: d.id, 
            mailId: d.id, 
            sentAt, 
            from, 
            to, 
            subject, 
            lastStatus,
            source: data?.source || 'app_web',
            sourceLabel: data?.sourceLabel || 'Enviado desde la app',
            sourceIcon: data?.sourceIcon || '💻',
            movements: data?.tracking?.movements || []
          };
        })
        .filter((message) => {
          // Para bandeja de entrada: excluir mensajes donde el usuario es el remitente
          if (selectedFolder === 'inbox') {
            // Obtener el senderName del documento original
            const doc = snap.docs.find(d => d.id === message.id);
            const data = doc?.data() as any;
            const senderName = data?.senderName;
            
            // Solo mostrar mensajes donde el usuario NO es el remitente
            return senderName !== appUser?.email;
          }
          return true;
        })
        .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
      
      setMessages(items);
      
      // Detectar duplicados después de actualizar mensajes
      detectDuplicates(items);
    });

    return () => {
      console.log(`🗑️ [${new Date().toISOString()}] Destruyendo listener para folder:`, selectedFolder);
      unsub();
    };
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

    if (sourceFilter !== 'all') {
      list = list.filter(msg => msg.source === sourceFilter);
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
  }, [messages, activeFilter, sourceFilter, searchQuery]);

  const folders: { id: Folder; label: string; icon: React.ReactNode }[] = [
    { id: 'inbox', label: 'Bandeja de Entrada', icon: <Inbox className="mr-3 h-5 w-5" /> },
    { id: 'sent', label: 'Enviados', icon: <Send className="mr-3 h-5 w-5" /> },
    { id: 'drafts', label: 'Borradores', icon: <FileEdit className="mr-3 h-5 w-5" /> },
    { id: 'archive', label: 'Archivo', icon: <Archive className="mr-3 h-5 w-5" /> },
    { id: 'trash', label: 'Papelera', icon: <Trash2 className="mr-3 h-5 w-5" /> },
  ];

  const contactosFolder = { id: 'contactos', label: 'Contactos', icon: <Users className="mr-3 h-5 w-5" /> };

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
        {appUser ? (
          <ComposeMessageDialog open={isComposeOpen} onOpenChange={setComposeOpen} user={appUser}>
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
        ) : (
          <Button className="w-full h-12 text-base" disabled>
            <PenSquare className="mr-2 h-5 w-5" />
            Inicia sesión para enviar
          </Button>
        )}
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
        
        {/* Separador */}
        <div className="my-4">
          <Separator />
        </div>
        
        {/* Botón de Contactos */}
        <Link href="/dashboard/contactos" className="w-full">
          <Button
            variant="ghost"
            className="w-full justify-start h-11 text-base"
          >
            {contactosFolder.icon}
            {contactosFolder.label}
          </Button>
        </Link>
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
            {showCleanupButton && (
              <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded-lg">
                <p className="text-sm text-yellow-800 mb-2">
                  ⚠️ Se detectaron mensajes duplicados o corruptos. 
                  <button 
                    onClick={async () => {
                      if (confirm('¿Eliminar mensajes duplicados/corruptos? Esta acción no se puede deshacer.')) {
                        console.log('🧹 Limpiando mensajes duplicados...');
                        
                        try {
                          // Filtrar mensajes duplicados/corruptos
                          const duplicates = messages.filter(msg => 
                            msg.subject.includes('Mensaje certificado de abengolea1@gmail.com') ||
                            msg.subject === 'Mensaje de prueba desde la app' ||
                            !msg.from
                          );
                          
                          console.log(`🗑️ Eliminando ${duplicates.length} mensajes duplicados...`);
                          
                          // Llamar al endpoint de limpieza
                          const response = await fetch('/api/clean-duplicates', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              messageIds: duplicates.map(msg => msg.id) 
                            })
                          });
                          
                          if (response.ok) {
                            console.log('✅ Limpieza completada');
                            setShowCleanupButton(false);
                            // Recargar la página para ver los cambios
                            window.location.reload();
                          } else {
                            console.error('❌ Error en limpieza:', await response.text());
                          }
                        } catch (error) {
                          console.error('❌ Error:', error);
                        }
                      }
                    }}
                    className="ml-2 text-yellow-900 underline hover:text-yellow-700"
                  >
                    Limpiar ahora
                  </button>
                </p>
              </div>
            )}
          </div>
          
          {/* Billetera en la parte superior derecha */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 p-3 bg-muted rounded-lg border">
              <Wallet className="h-5 w-5 text-primary" />
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Créditos</div>
                <div className="font-bold text-lg text-primary">{appUser?.creditos || 0}</div>
              </div>
              <Link href="/dashboard/billetera">
                <Button variant="outline" size="sm" className="ml-2">
                  Ver Billetera
                </Button>
              </Link>
            </div>
            {appUser ? <UserNav user={appUser} /> : null}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {selectedFolder === 'contactos' ? (
            <ContactosPageComponent />
          ) : (
            <>
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
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>{selectedFolder === 'inbox' ? 'De' : 'Para'}</TableHead>
                  <TableHead>{selectedFolder === 'inbox' ? 'Asunto' : 'Asunto'}</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Movimientos</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMessages.map((message) => {
                  const messageType = 'Comunicación';
                  return (
                    <TableRow 
                      key={message.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => window.location.href = `/dashboard/mensaje/${message.id}`}
                    >
                      <TableCell>
                        <FormattedDateCell date={message.sentAt} />
                      </TableCell>
                      <TableCell>
                        {messageType}
                      </TableCell>
                      <TableCell className="font-medium text-primary">
                        {selectedFolder === 'inbox' ? message.from : message.to.join(', ')}
                      </TableCell>
                      <TableCell>
                        {message.subject}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            message.lastStatus === 'Leído' ? 'default' : 
                            message.lastStatus === 'Abierto' ? 'secondary' :
                            message.lastStatus === 'Entregado' ? 'outline' :
                            message.lastStatus === 'Error' ? 'destructive' : 'secondary'
                          }
                        >
                          {message.lastStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {message.movements?.length || 0} eventos
                          </Badge>
                          {message.movements && message.movements.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {message.movements.filter((m: any) => m.type === 'email_opened').length} aperturas
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{message.sourceIcon}</span>
                          <span className="text-sm text-muted-foreground">{message.sourceLabel}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
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
            </>
          )}
        </main>
      </div>
      
      {/* Enlace pequeño al admin */}
      <div className="fixed bottom-4 right-4">
        <Link 
          href="/admin/login" 
          className="inline-flex items-center gap-2 px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
        >
          <Settings className="h-3 w-3" />
          Admin
        </Link>
      </div>

    </div>
  );
}




















