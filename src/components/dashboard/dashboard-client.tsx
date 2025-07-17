
"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  FileText,
  PlusCircle,
  Search,
  Menu,
  Inbox,
  Send,
  FileEdit,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { mockMessages, mockUser } from '@/lib/mock-data';
import type { Mensaje } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

import { ComposeMessageDialog } from './compose-message-dialog';
import MessageView from './message-view';
import { UserNav } from './user-nav';
import { Logo } from '../logo';

type Folder = "inbox" | "sent" | "drafts" | "trash";

export default function DashboardClient() {
  const [selectedMessage, setSelectedMessage] = useState<Mensaje | null>(null);
  const [isComposeOpen, setComposeOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<Folder>("inbox");

  const filteredMessages = useMemo(() => {
    const sorted = [...mockMessages].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    switch (selectedFolder) {
      case 'inbox':
        return sorted.filter(m => m.destinatario.uid === mockUser.uid);
      case 'sent':
        return sorted.filter(m => m.remitente.uid === mockUser.uid);
      // Mock data doesn't have drafts or trash, so these will be empty for now.
      case 'drafts':
        return [];
      case 'trash':
        return [];
      default:
        return sorted;
    }
  }, [selectedFolder]);
  
  // Set the initial selected message from the filtered list
  React.useEffect(() => {
    if (filteredMessages.length > 0) {
      setSelectedMessage(filteredMessages[0]);
    } else {
      setSelectedMessage(null);
    }
  }, [filteredMessages]);


  const getStatusInfo = (message: Mensaje) => {
    switch (message.estadoEnvio) {
      case 'leido':
        return {
          icon: <Badge className="w-2 h-2 p-0 bg-accent" />,
          label: 'Leído',
        };
      case 'recibido':
        return {
          icon: <Badge className="w-2 h-2 p-0 bg-primary" />,
          label: 'Recibido',
        };
      case 'enviado':
      default:
        return {
          icon: <Badge className="w-2 h-2 p-0 bg-muted-foreground/50" />,
          label: 'Enviado',
        };
    }
  };
  
  const folders: { id: Folder; label: string; icon: React.ReactNode }[] = [
      { id: 'inbox', label: 'Recibidos', icon: <Inbox className="h-5 w-5" /> },
      { id: 'sent', label: 'Enviados', icon: <Send className="h-5 w-5" /> },
      { id: 'drafts', label: 'Borradores', icon: <FileEdit className="h-5 w-5" /> },
      { id: 'trash', label: 'Papelera', icon: <Trash2 className="h-5 w-5" /> },
  ];

  const messageList = (
    <div className="flex flex-col">
       <div className="p-4 space-y-4">
           <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar mensajes..."
                className="pl-8 w-full"
              />
            </div>
      </div>
      <Separator />
       <nav className="grid gap-1 p-2">
        {folders.map((folder) => (
          <TooltipProvider key={folder.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={selectedFolder === folder.id ? 'secondary' : 'ghost'}
                className="justify-start gap-2"
                onClick={() => setSelectedFolder(folder.id)}
              >
                {folder.icon}
                <span>{folder.label}</span>
                 {folder.id === 'inbox' && <Badge className="ml-auto">{mockMessages.filter(m => m.destinatario.uid === mockUser.uid).length}</Badge>}
                 {folder.id === 'sent' && <Badge className="ml-auto">{mockMessages.filter(m => m.remitente.uid === mockUser.uid).length}</Badge>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={5}>
              {folder.label}
            </TooltipContent>
          </Tooltip>
          </TooltipProvider>
        ))}
      </nav>
      <Separator />
      <div className="flex-1 overflow-y-auto">
        <nav className="grid gap-1 p-2">
          {filteredMessages.length > 0 ? (
            filteredMessages.map((message) => (
            <button
              key={message.id}
              onClick={() => setSelectedMessage(message)}
              className={cn(
                'flex flex-col items-start gap-2 rounded-lg p-3 text-left text-sm transition-all hover:bg-muted',
                selectedMessage?.id === message.id && 'bg-primary/10'
              )}
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusInfo(message).icon}
                  <div className="font-semibold">
                    {message.remitente.uid === mockUser.uid
                      ? message.destinatario.nombre
                      : message.remitente.nombre}
                  </div>
                </div>
                 <div className="text-xs text-muted-foreground">
                    {format(new Date(message.timestamp), 'dd/MM/yyyy', { locale: es })}
                </div>
              </div>
               <div className="line-clamp-2 text-xs text-muted-foreground">
                {message.contenido.substring(0, 100)}...
              </div>
               {message.prioridad !== 'normal' && (
                 <Badge 
                    variant={message.prioridad === 'urgente' ? 'destructive' : 'secondary'} 
                    className="capitalize text-xs"
                  >
                   {message.prioridad}
                 </Badge>
               )}
            </button>
          ))
          ) : (
             <div className="p-4 text-center text-sm text-muted-foreground">
                No hay mensajes en esta carpeta.
              </div>
          )}
        </nav>
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
       <ComposeMessageDialog open={isComposeOpen} onOpenChange={setComposeOpen}>
          {/* This empty div is a placeholder for the trigger which is now in the header */}
          <div />
        </ComposeMessageDialog>
      <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
        <div className="hidden border-r bg-card lg:flex lg:flex-col">
          <div className="flex h-16 items-center border-b px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <Logo className="h-8 w-8 text-primary" />
              <span className='text-xl'>Notificas</span>
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto">
            {messageList}
          </div>
        </div>
        <div className="flex flex-col">
          <header className="flex h-16 items-center gap-4 border-b bg-card px-6">
            <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0 lg:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Alternar menú de navegación</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex flex-col p-0">
                  <SheetHeader className="border-b">
                    <SheetTitle className="p-4">
                        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                        <Logo className="h-8 w-8 text-primary" />
                        <span className='text-xl'>Notificas</span>
                        </Link>
                    </SheetTitle>
                  </SheetHeader>
                  <div className="overflow-y-auto">
                    {messageList}
                  </div>
                </SheetContent>
              </Sheet>

             <div className="flex-1">
                 {selectedMessage && (
                    <h1 className="text-lg font-semibold md:text-xl hidden sm:block">
                       Conversación con {selectedMessage.remitente.uid === mockUser.uid
                          ? selectedMessage.destinatario.nombre
                          : selectedMessage.remitente.nombre}
                    </h1>
                 )}
            </div>
             <div className="flex items-center gap-2">
                <Button onClick={() => setComposeOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nuevo Mensaje
                </Button>
                <UserNav user={mockUser} />
             </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
            {selectedMessage ? (
              <MessageView message={selectedMessage} currentUser={mockUser} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <FileText className="h-16 w-16 mb-4" />
                <h2 className="text-2xl font-semibold">Ningún mensaje seleccionado</h2>
                <p>Selecciona un mensaje de la lista para ver sus detalles.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
