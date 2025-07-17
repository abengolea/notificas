
"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Archive,
  ChevronDown,
  ChevronRight,
  FileText,
  Inbox,
  LogOut,
  PenSquare,
  Search,
  Send,
  User,
  Wallet,
  FileEdit,
  Trash2,
  Mail,
  ReceiptText,
  MessageSquareReply,
  Megaphone,
  Scale,
  Gavel,
} from 'lucide-react';

import { mockMessages, mockUser } from '@/lib/mock-data';
import type { Mensaje } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"


import { ComposeMessageDialog } from './compose-message-dialog';
import MessageView from './message-view';
import { UserNav } from './user-nav';
import { Logo } from '../logo';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type Folder = "inbox" | "sent" | "drafts" | "archive" | "trash";
type MessageTypeFilter = "all" | "Comunicación" | "Notificación" | "Contestación" | "Oferta" | "Intimación" | "Oficio Judicial";


const messageTypeIcons = {
    "Comunicación": <Mail className="mr-2 h-4 w-4" />,
    "Notificación": <ReceiptText className="mr-2 h-4 w-4" />,
    "Contestación": <MessageSquareReply className="mr-2 h-4 w-4" />,
    "Oferta": <Megaphone className="mr-2 h-4 w-4" />,
    "Intimación": <Scale className="mr-2 h-4 w-4" />,
    "Oficio Judicial": <Gavel className="mr-2 h-4 w-4" />,
};

const getUltimoEstado = (message: Mensaje) => {
    if (message.estadoEnvio === 'leido') return 'Apertura de email';
    if (message.bfaLeido?.dispositivoLector) return 'Lectura de documento desde link del email';
    return 'Enviado';
}

export default function DashboardClient() {
  const [isComposeOpen, setComposeOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<Folder>("inbox");
  const [activeFilter, setActiveFilter] = useState<MessageTypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");


  const messageCountsByType = useMemo(() => {
    const counts: Record<string, number> = {
        "Comunicación": 0,
        "Notificación": 0,
        "Contestación": 0,
        "Oferta": 0,
        "Intimación": 0,
        "Oficio Judicial": 0,
    };
    // This is a mock, in a real app this would be more complex
    mockMessages.forEach(message => {
        const type = message.prioridad === 'urgente' ? 'Notificación' : message.prioridad === 'alta' ? 'Intimación' : 'Comunicación';
        if(type === 'Notificación') counts['Notificación']++;
        if(type === 'Intimación') counts['Intimación']++;
        // You can add more detailed logic here for other types
    })
    
    // For demonstration, let's just set some mock values based on your description
    counts["Notificación"] = mockMessages.filter(m => m.prioridad === 'urgente').length;
    counts["Intimación"] = mockMessages.filter(m => m.prioridad === 'alta').length;
    counts["Contestación"] = 2; // Mock
    counts["Oficio Judicial"] = 1; // Mock
    return counts;
  }, [mockMessages]);


  const filteredMessages = useMemo(() => {
    let messages = [...mockMessages].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // This is a simplified filter logic based on mock data and selected folder
    if (selectedFolder === 'inbox') {
        messages = messages.filter(m => m.destinatario.uid === mockUser.uid);
    } else if (selectedFolder === 'sent') {
        messages = messages.filter(m => m.remitente.uid === mockUser.uid);
    } else if (selectedFolder === 'trash'){
        messages = []; // Mock for now
    } else if (selectedFolder === 'drafts'){
        messages = []; // Mock for now
    } else if (selectedFolder === 'archive'){
        messages = []; // Mock for now
    }


    if (activeFilter !== "all") {
        messages = messages.filter(m => {
             const typeMap: Record<Mensaje['prioridad'], MessageTypeFilter> = {
                'normal': 'Comunicación',
                'alta': 'Intimación',
                'urgente': 'Notificación'
             }
             const messageType = typeMap[m.prioridad] || 'Comunicación';
             // Simplified filter logic
             if (activeFilter === 'Notificación' && messageType === 'Notificación') return true;
             if (activeFilter === 'Intimación' && messageType === 'Intimación') return true;
             if (activeFilter === 'Contestación' && messageType === 'Contestación') return true; // Will be empty with current mock
             if (activeFilter === 'Oficio Judicial' && messageType === 'Oficio Judicial') return true; // will be empty
             // Add more types if needed
             return false;
        });
    }

    if (searchQuery) {
        const lowercasedQuery = searchQuery.toLowerCase();
        messages = messages.filter(m =>
            m.remitente.nombre.toLowerCase().includes(lowercasedQuery) ||
            m.destinatario.nombre.toLowerCase().includes(lowercasedQuery) ||
            m.contenido.toLowerCase().includes(lowercasedQuery)
        );
    }
    
    return messages;
  }, [selectedFolder, activeFilter, searchQuery]);


  const folders: { id: Folder; label: string; icon: React.ReactNode }[] = [
      { id: 'inbox', label: 'Bandeja de Entrada', icon: <Inbox className="mr-3 h-5 w-5" /> },
      { id: 'sent', label: 'Enviados', icon: <Send className="mr-3 h-5 w-5" /> },
      { id: 'drafts', label: 'Borradores', icon: <FileEdit className="mr-3 h-5 w-5" /> },
      { id: 'archive', label: 'Archivo', icon: <Archive className="mr-3 h-5 w-5" /> },
      { id: 'trash', label: 'Papelera', icon: <Trash2 className="mr-3 h-5 w-5" /> },
  ];
  
  const totalNotifications = filteredMessages.length;

  const sidebar = (
    <div className="flex flex-col h-full bg-card text-card-foreground">
        <div className="flex items-center justify-center h-20 border-b px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <Logo className="h-12 w-auto" />
            </Link>
        </div>

        <div className="p-4">
             <ComposeMessageDialog open={isComposeOpen} onOpenChange={setComposeOpen}>
                <Button className="w-full h-12 text-base" onClick={() => setComposeOpen(true)}>
                    <PenSquare className="mr-2 h-5 w-5" />
                    NUEVO ENVÍO
                </Button>
            </ComposeMessageDialog>
        </div>

        <nav className="flex-1 px-4 space-y-2">
            {folders.map(folder => (
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
                    <User className="mr-3 h-5 w-5" />
                    Mi Perfil
                </Link>
             </div>
             <div>
                <Link href="/" className="flex items-center text-base font-medium text-card-foreground/80 hover:text-primary">
                    <LogOut className="mr-3 h-5 w-5" />
                    Cerrar sesión
                </Link>
             </div>

            <Separator />
            
            <div className="space-y-2">
                <div className="flex items-center text-lg font-semibold">
                    <Wallet className="mr-2 h-6 w-6" />
                    Billetera
                </div>
                <div className="flex justify-between items-center text-sm p-3 bg-muted rounded-lg">
                    <span>Créditos</span>
                    <span className="font-bold text-destructive">-5900</span>
                </div>
            </div>
            
            <div className="text-center">
                <a href="mailto:info@ucu.org.ar" className="text-sm text-muted-foreground hover:underline">info@ucu.org.ar</a>
            </div>
        </div>
    </div>
  )

  return (
      <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
        <div className="hidden lg:block border-r">
          {sidebar}
        </div>
        <div className="flex flex-col bg-background">
          <header className="flex h-16 items-center gap-4 border-b bg-card px-6 lg:hidden">
              <UserNav user={mockUser} />
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                <h1 className="text-2xl font-semibold">{folders.find(f => f.id === selectedFolder)?.label} <span className="text-muted-foreground">(Notificaciones Recientes)</span></h1>
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
                     {Object.entries(messageCountsByType).map(([type, count]) => (
                        <Button key={type} variant={activeFilter === type ? 'default' : 'outline'} className="rounded-full" onClick={() => setActiveFilter(type as MessageTypeFilter)}>
                             {messageTypeIcons[type as keyof typeof messageTypeIcons]}
                             {type}
                             <Badge variant="secondary" className="ml-2">{count}</Badge>
                        </Button>
                     ))}
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
                        const messageType = message.prioridad === 'urgente' ? 'Notificación' : 'Intimación';
                        return (
                             <TableRow key={message.id}>
                              <TableCell>{format(new Date(message.timestamp), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
                              <TableCell>{messageType}</TableCell>
                              <TableCell className="font-medium text-primary hover:underline cursor-pointer">{message.remitente.nombre}</TableCell>
                              <TableCell>{message.destinatario.nombre}</TableCell>
                              <TableCell>Notificación - </TableCell>
                              <TableCell>{getUltimoEstado(message)}</TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem>Ver Detalles</DropdownMenuItem>
                                        <DropdownMenuItem>Archivar</DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive">Eliminar</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                        )
                    })}
                  </TableBody>
                </Table>
            </Card>


          </main>
        </div>
      </div>
  );
}
