
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  ChevronRight,
  Search,
  Mail,
  ReceiptText,
  MessageSquareReply,
  Megaphone,
  Scale,
  Gavel,
  AlertCircle,
} from 'lucide-react';

import type { User as AppUser } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

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

import { DashboardShell, type MailFolderNavId } from './dashboard-shell';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { auth, db } from '@/lib/firebase';
import { countRecipientOpenMovements, filterRecipientVisibleMovements } from '@/lib/tracking-movements';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

type MessageTypeFilter = "all" | "Comunicación" | "Notificación" | "Contestación" | "Oferta" | "Intimación" | "Oficio Judicial";
type SourceFilter = "all" | "app_web" | "external_email";

/** Evita desuscribirse de una query e inscribir la siguiente en el mismo ciclo — dispara FIRESTORE INTERNAL (ca9/b815). */
const MAIL_LIST_SNAPSHOT_DEFER_MS = 150;

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

function docsToSortedDisplayMessages(
  docs: QueryDocumentSnapshot<DocumentData>[],
  folder: MailFolderNavId,
  userEmailNorm: string,
): DisplayMessage[] {
  return docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;

      const sentAt =
        (data?.delivery as { time?: { toDate?: () => Date } } | undefined)?.time?.toDate?.() ||
        (data?.tracking as { sentAt?: { toDate?: () => Date } } | undefined)?.sentAt?.toDate?.() ||
        (data?.createdAt as { toDate?: () => Date } | undefined)?.toDate?.() ||
        new Date();
      const from = typeof data?.from === "string" ? data.from : "contacto@notificas.com";
      const rawTo = data?.to;
      const to = Array.isArray(rawTo)
        ? (rawTo as string[])
        : rawTo
          ? [String(rawTo)]
          : [];
      const msg = data?.message as { subject?: string } | undefined;
      const subject = msg?.subject || "Sin asunto";

      const movements = (data?.tracking as { movements?: unknown[] } | undefined)?.movements || [];
      const emailSentCount = movements.filter((m: unknown) => (m as { type?: string }).type === "email_sent").length;
      const emailOpenedCount = movements.filter((m: unknown) => (m as { type?: string }).type === "email_opened").length;
      const appOpenedCount = movements.filter(
        (m: unknown) => (m as { type?: string; viewerIsSender?: boolean }).type === "app_opened" && !(m as { viewerIsSender?: boolean }).viewerIsSender,
      ).length;
      const readConfirmedCount = movements.filter((m: unknown) => (m as { type?: string }).type === "read_confirmed").length;

      let lastStatus: string;
      if (readConfirmedCount > 0) {
        lastStatus = "Leído";
      } else if (emailOpenedCount > 0 || appOpenedCount > 0) {
        lastStatus = "Abierto";
      } else if (emailSentCount > 0) {
        lastStatus = "Entregado";
      } else {
        lastStatus = "Pendiente";
      }

      return {
        id: d.id,
        mailId: d.id,
        sentAt,
        from,
        to,
        subject,
        lastStatus,
        source: typeof data?.source === "string" ? data.source : "app_web",
        sourceLabel: typeof data?.sourceLabel === "string" ? data.sourceLabel : "Enviado desde la app",
        sourceIcon: typeof data?.sourceIcon === "string" ? data.sourceIcon : "💻",
        movements: (Array.isArray(movements) ? movements : []) as any[],
      };
    })
    .filter((message) => {
      if (folder === "inbox") {
        const docMatch = docs.find((x) => x.id === message.id);
        const data = docMatch?.data() as { senderName?: string } | undefined;
        const senderName = data?.senderName;
        return senderName?.trim().toLowerCase() !== userEmailNorm;
      }
      return true;
    })
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
}

export default function DashboardClient() {
  const [selectedFolder, setSelectedFolder] = useState<MailFolderNavId>("sent");
  const [activeFilter, setActiveFilter] = useState<MessageTypeFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  /** Generación del efecto mail: ignora timeouts/listeners que quedaron obsoletos al cambiar carpeta. */
  const mailListListenSeqRef = useRef(0);
  const migrationPasswordFlagRef = useRef(false);

  useEffect(() => {
    let unsubFirestore: (() => void) | undefined;
    let unsubAuth: (() => void) | undefined;

    auth.authStateReady().then(() => {
      unsubAuth = onAuthStateChanged(auth, (u) => {
        void (async () => {
          setAppUser(mapAuthUserToAppUser(u));

          unsubFirestore?.();
          unsubFirestore = undefined;

          if (!u?.uid) return;

          // Asegura que Firestore lleve el JWT actual (evita permission-denied justo tras login).
          try {
            await u.getIdToken();
          } catch (e) {
            console.error("Error obteniendo token de Auth antes de Firestore:", e);
            return;
          }

          const userRef = doc(db, 'users', u.uid);

          unsubFirestore = onSnapshot(
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
                  creditos:
                    typeof userData?.creditos === "number" ? userData.creditos : prev.creditos,
                  perfil: {
                    ...prev.perfil,
                    ...(userData?.perfil || {}),
                    verificado:
                      userData?.perfil?.verificado ?? prev.perfil.verificado,
                  },
                };
              });
            },
            (error) => {
              console.error("Error cargando datos del usuario (users/{uid}):", error?.code ?? error);
            },
          );
        })();
      });
    });

    return () => {
      unsubAuth?.();
      unsubFirestore?.();
    };
  }, []);

  /** Marca en Firestore que el usuario migrado ya pudo entrar (contraseña definida vía flujo seguro). */
  useEffect(() => {
    if (!appUser?.uid || migrationPasswordFlagRef.current) return;
    void (async () => {
      try {
        await auth.authStateReady();
        const u = auth.currentUser;
        if (!u) return;
        const token = await u.getIdToken();
        const r = await fetch("/api/user/migration-password-complete", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) migrationPasswordFlagRef.current = true;
      } catch {
        /* reintentar en otra visita */
      }
    })();
  }, [appUser?.uid]);

  useEffect(() => {
    const seq = ++mailListListenSeqRef.current;
    let unsubMail: (() => void) | undefined;
    let deferHandle: ReturnType<typeof setTimeout> | undefined;

    if (!appUser?.uid) return;

    deferHandle = setTimeout(() => {
      void (async () => {
        await auth.authStateReady();
        if (seq !== mailListListenSeqRef.current) return;

        const u = auth.currentUser;
        if (!u) {
          setMessages([]);
          return;
        }

        try {
          await u.getIdToken(true);
        } catch (e) {
          console.error("Error obteniendo token antes del listener mail:", e);
          setMessages([]);
          return;
        }

        if (seq !== mailListListenSeqRef.current) return;

        const userEmailNorm = u.email?.trim().toLowerCase();

        if (selectedFolder !== "inbox" && selectedFolder !== "sent") {
          setMessages([]);
          return;
        }

        if (!userEmailNorm) {
          setMessages([]);
          return;
        }

        if (seq !== mailListListenSeqRef.current) return;

        const mailCol = collection(db, "mail");
        let lastProcessedData = "";

        const onMailListError =
          (label: string) => (error: unknown) => {
          if (seq !== mailListListenSeqRef.current) return;
          const u2 = auth.currentUser;
          console.error(
            `Error escuchando correos (${label}, colección mail):`,
            (error as { code?: unknown })?.code ?? error,
            "| folder:", selectedFolder,
            "| uid:", u2?.uid ?? "null",
            "| email:", u2?.email ?? "null",
          );
          setMessages([]);
        };

        if (selectedFolder === "inbox") {
          // Usamos recipientEmail == email (scalar ==) en vez de to array-contains:
          // Firestore no puede validar array-contains contra request.auth.token.email
          // simbólicamente — rechaza la query con permission-denied aunque el usuario
          // esté autenticado y el email esté en el array.
          const qRec = query(mailCol, where("recipientEmail", "==", userEmailNorm));

          unsubMail = onSnapshot(
            qRec,
            { includeMetadataChanges: false },
            (snap) => {
              if (seq !== mailListListenSeqRef.current) return;
              const dataHash = JSON.stringify({
                totalDocs: snap.docs.length,
                docIds: snap.docs.map((d) => d.id).sort(),
              });
              if (dataHash === lastProcessedData) return;
              lastProcessedData = dataHash;
              setMessages(
                docsToSortedDisplayMessages(snap.docs, "inbox", userEmailNorm),
              );
            },
            onMailListError("inbox recipientEmail=="),
          );
        } else {
          const q = query(mailCol, where("createdBy", "==", u.uid));

          unsubMail = onSnapshot(
            q,
            { includeMetadataChanges: false },
            (snap) => {
              if (seq !== mailListListenSeqRef.current) return;

              const dataHash = JSON.stringify({
                totalDocs: snap.docs.length,
                docIds: snap.docs.map((d) => d.id).sort(),
                changes: snap.docChanges().map((change) => ({
                  type: change.type,
                  docId: change.doc.id,
                })),
              });

              if (dataHash === lastProcessedData) return;
              lastProcessedData = dataHash;

              setMessages(
                docsToSortedDisplayMessages(snap.docs, "sent", userEmailNorm),
              );
            },
            onMailListError("sent createdBy=="),
          );
        }
      })();
    }, MAIL_LIST_SNAPSHOT_DEFER_MS);

    return () => {
      // Incrementar seq en cleanup invalida errores de Firestore que se encolen
      // después de unsub (race condition al cambiar de carpeta).
      ++mailListListenSeqRef.current;
      if (deferHandle !== undefined) clearTimeout(deferHandle);
      unsubMail?.();
      unsubMail = undefined;
    };
  }, [selectedFolder, appUser?.uid]);

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

  const folders: { id: MailFolderNavId; label: string }[] = [
    { id: 'inbox', label: 'Bandeja de Entrada' },
    { id: 'sent', label: 'Enviados' },
    { id: 'drafts', label: 'Borradores' },
    { id: 'archive', label: 'Archivo' },
    { id: 'trash', label: 'Papelera' },
  ];

  const isSuspended = appUser?.estado === 'suspendido';
  const totalNotifications = filteredMessages.length;

  const headerTitle = folders.find((f) => f.id === selectedFolder)?.label ?? 'Dashboard';
  const router = useRouter();

  return (
    <DashboardShell
      headerTitle={headerTitle}
      folderNavMode="client"
      selectedMailFolder={selectedFolder}
      onMailFolderSelect={setSelectedFolder}
      syncAuthFromParent
      parentAppUser={appUser}
    >
      <div className="space-y-6">
              {isSuspended && (
                <div className="p-4 bg-warning/10 border-l-4 border-warning rounded-r-lg">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-warning" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-warning-foreground">
                        Tu cuenta está suspendida debido a un problema con el pago. Puedes ver tus mensajes, pero no podrás enviar nuevos hasta que se resuelva.
                        {' '}
                        <Link href="/dashboard/billetera" className="font-medium underline hover:text-warning">
                          Ir a la billetera para solucionarlo.
                        </Link>
                      </p>
                    </div>
                  </div>
                </div>
              )}
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <h1 className="text-balance text-xl font-semibold sm:text-2xl">
              {folders.find((f) => f.id === selectedFolder)?.label}{' '}
              <span className="text-muted-foreground block text-base font-normal sm:inline sm:text-2xl sm:font-semibold">
                (Notificaciones recientes)
              </span>
            </h1>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Qué desea buscar"
              className="pl-10 h-12 text-base rounded-full shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Total de Notificaciones: {totalNotifications}</p>
            <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto overflow-y-hidden px-1 pb-1 [-webkit-overflow-scrolling:touch] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
              <h3 className="mr-2 shrink-0 self-center text-base font-semibold md:mr-4 md:text-lg">Tipos</h3>
              <Button
                variant={activeFilter === 'all' ? 'default' : 'outline'}
                className="shrink-0 rounded-full"
                onClick={() => setActiveFilter('all')}
              >
                Todos
                <Badge variant="secondary" className="ml-2">{messageCountsByType.all}</Badge>
              </Button>
              {Object.entries(messageCountsByType).map(([type, count]) => {
                if (type === 'all' || count === 0) return null;
                return (
                  <Button key={type} variant={activeFilter === type ? 'default' : 'outline'} className="shrink-0 rounded-full" onClick={() => setActiveFilter(type as MessageTypeFilter)}>
                    {messageTypeIcons[type as keyof typeof messageTypeIcons]}
                    {type}
                    <Badge variant="secondary" className="ml-2">{count}</Badge>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredMessages.map((message) => {
              const messageType = 'Comunicación';
              const statusVariant =
                message.lastStatus === 'Leído'
                  ? 'default'
                  : message.lastStatus === 'Abierto'
                    ? 'secondary'
                    : message.lastStatus === 'Entregado'
                      ? 'outline'
                      : message.lastStatus === 'Error'
                        ? 'destructive'
                        : 'secondary';
              return (
                <Link key={message.id} href={`/dashboard/mensaje/${message.id}`} className="block">
                  <Card className="shadow-md transition-colors active:bg-muted/40">
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          <FormattedDateCell date={message.sentAt} />
                        </p>
                        <Badge variant={statusVariant} className="shrink-0 text-xs">
                          {message.lastStatus}
                        </Badge>
                      </div>
                      <p className="line-clamp-2 font-medium leading-snug">{message.subject}</p>
                      <p className="text-sm text-primary">
                        {selectedFolder === 'inbox' ? message.from : message.to.join(', ')}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{messageType}</span>
                        <span className="text-border">·</span>
                        <span>{message.sourceLabel}</span>
                        <span className="text-border">·</span>
                        <span>
                          {filterRecipientVisibleMovements(message.movements).length} eventos
                          {filterRecipientVisibleMovements(message.movements).length > 0
                            ? ` (${countRecipientOpenMovements(message.movements)} aperturas)`
                            : ''}
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>

          <Card className="hidden shadow-lg md:block md:overflow-x-auto">
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
                      onClick={() => router.push(`/dashboard/mensaje/${message.id}`)}
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
                            {filterRecipientVisibleMovements(message.movements).length} eventos
                          </Badge>
                          {filterRecipientVisibleMovements(message.movements).length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {countRecipientOpenMovements(message.movements)} aperturas
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
      </div>
    </DashboardShell>
  );
}




















