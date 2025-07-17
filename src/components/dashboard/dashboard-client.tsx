"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  FileText,
  PlusCircle,
  Search,
  ShieldCheck,
} from 'lucide-react';

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
import { ComposeMessageDialog } from './compose-message-dialog';
import MessageView from './message-view';
import { UserNav } from './user-nav';

export default function DashboardClient() {
  const [selectedMessage, setSelectedMessage] = useState<Mensaje | null>(
    mockMessages[0] || null
  );
  const [isComposeOpen, setComposeOpen] = useState(false);

  const sortedMessages = useMemo(() => {
    return [...mockMessages].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }, []);

  const getStatusInfo = (message: Mensaje) => {
    switch (message.estadoEnvio) {
      case 'leido':
        return {
          icon: <Badge className="w-2 h-2 p-0 bg-accent" />,
          label: 'Read',
        };
      case 'recibido':
        return {
          icon: <Badge className="w-2 h-2 p-0 bg-primary" />,
          label: 'Received',
        };
      case 'enviado':
      default:
        return {
          icon: <Badge className="w-2 h-2 p-0 bg-muted-foreground/50" />,
          label: 'Sent',
        };
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
        <div className="hidden border-r bg-card lg:flex lg:flex-col">
          <div className="flex h-16 items-center border-b px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <span>BFA Certify</span>
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
                 <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search messages..."
                      className="pl-8 w-full"
                    />
                  </div>
                 <ComposeMessageDialog open={isComposeOpen} onOpenChange={setComposeOpen}>
                    <Button className="w-full" onClick={() => setComposeOpen(true)}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      New Message
                    </Button>
                </ComposeMessageDialog>
            </div>
            <Separator />
            <nav className="grid gap-1 p-2">
              {sortedMessages.map((message) => (
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
                        {message.timestamp.toLocaleDateString()}
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
              ))}
            </nav>
          </div>
        </div>
        <div className="flex flex-col">
          <header className="flex h-16 items-center gap-4 border-b bg-card px-6">
             <div className="flex-1">
                 {selectedMessage && (
                    <h1 className="text-lg font-semibold">
                       Conversation with {selectedMessage.remitente.uid === mockUser.uid
                          ? selectedMessage.destinatario.nombre
                          : selectedMessage.remitente.nombre}
                    </h1>
                 )}
            </div>
             <UserNav user={mockUser} />
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
            {selectedMessage ? (
              <MessageView message={selectedMessage} currentUser={mockUser} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <FileText className="h-16 w-16 mb-4" />
                <h2 className="text-2xl font-semibold">No message selected</h2>
                <p>Select a message from the list to view its details.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
