"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth";
import {
  Archive,
  FileEdit,
  Inbox,
  LogOut,
  Menu,
  PenSquare,
  Send,
  Settings,
  Trash2,
  User as UserIcon,
  Wallet,
  Users,
} from "lucide-react";

import type { User as AppUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { ComposeMessageDialog } from "@/components/dashboard/compose-message-dialog";
import { UserNav } from "@/components/dashboard/user-nav";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { auth } from "@/lib/firebase";

export type MailFolderNavId =
  | "inbox"
  | "sent"
  | "drafts"
  | "archive"
  | "trash";

export type DashboardShellFolderNavMode = "client" | "route";

function mapAuthUserToAppUser(u: FirebaseUser | null): AppUser | null {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email || "",
    tipo: "individual",
    estado: "activo",
    perfil: {
      nombre: u.displayName || u.email || "Usuario",
      verificado: true,
    },
    createdAt: new Date(),
    lastLogin: new Date(),
    avatarUrl: u.photoURL || undefined,
    creditos: 0,
  };
}

type FolderDef = { id: MailFolderNavId; label: string; icon: React.ReactNode };

const folders: FolderDef[] = [
  { id: "inbox", label: "Bandeja de Entrada", icon: <Inbox className="mr-3 h-5 w-5" /> },
  { id: "sent", label: "Enviados", icon: <Send className="mr-3 h-5 w-5" /> },
  { id: "drafts", label: "Borradores", icon: <FileEdit className="mr-3 h-5 w-5" /> },
  { id: "archive", label: "Archivo", icon: <Archive className="mr-3 h-5 w-5" /> },
  { id: "trash", label: "Papelera", icon: <Trash2 className="mr-3 h-5 w-5" /> },
];

const contactosNav = {
  id: "contactos" as const,
  label: "Contactos",
  icon: <Users className="mr-3 h-5 w-5" />,
};

export type DashboardShellProps = {
  children: React.ReactNode;
  headerTitle: string;
  folderNavMode: DashboardShellFolderNavMode;
  selectedMailFolder?: MailFolderNavId;
  onMailFolderSelect?: (id: MailFolderNavId) => void;
  /** Si true, usa `parentAppUser` y no suscribe auth aquí (evita duplicar listener con DashboardClient). */
  syncAuthFromParent?: boolean;
  parentAppUser?: AppUser | null;
};

export function DashboardShell({
  children,
  headerTitle,
  folderNavMode,
  selectedMailFolder = "sent",
  onMailFolderSelect,
  syncAuthFromParent = false,
  parentAppUser = null,
}: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const onContactosRoute = pathname?.startsWith("/dashboard/contactos") ?? false;

  const [isComposeOpen, setComposeOpen] = useState(false);
  const [appUserInternal, setAppUserInternal] = useState<AppUser | null>(null);

  const appUser = syncAuthFromParent ? parentAppUser : appUserInternal;

  useEffect(() => {
    if (syncAuthFromParent) return;
    const unsub = onAuthStateChanged(auth, (u) => setAppUserInternal(mapAuthUserToAppUser(u)));
    return () => unsub();
  }, [syncAuthFromParent]);

  const isSuspended = appUser?.estado === "suspendido";

  const sidebarContent = (
    <>
      <div className="flex items-center justify-center h-20 border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
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
        {folders.map((folder) => {
          const active = folderNavMode === "client" && selectedMailFolder === folder.id;
          if (folderNavMode === "route") {
            return (
              <Button key={folder.id} variant="ghost" className="w-full justify-start h-11 text-base" asChild>
                <Link href="/dashboard" className="flex w-full items-center">
                  {folder.icon}
                  {folder.label}
                </Link>
              </Button>
            );
          }
          return (
            <Button
              key={folder.id}
              variant={active ? "secondary" : "ghost"}
              className="w-full justify-start h-11 text-base"
              onClick={() => onMailFolderSelect?.(folder.id)}
            >
              {folder.icon}
              {folder.label}
            </Button>
          );
        })}

        <div className="my-4">
          <Separator />
        </div>

        <Button
          variant={onContactosRoute ? "secondary" : "ghost"}
          className="w-full justify-start h-11 text-base"
          asChild
        >
          <Link href="/dashboard/contactos" className="flex w-full items-center">
            {contactosNav.icon}
            {contactosNav.label}
          </Link>
        </Button>
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
          <Button
            variant="ghost"
            className="w-full justify-start text-base font-medium text-card-foreground/80 hover:text-primary"
            onClick={async () => {
              await signOut(auth);
              router.push("/");
            }}
            aria-label="Cerrar sesión"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Cerrar sesión
          </Button>
        </div>

        <Separator />

        <div className="space-y-2">
          <Link href="/dashboard/billetera" className="flex items-center text-lg font-semibold hover:text-primary">
            <Wallet className="mr-2 h-6 w-6" />
            Billetera
          </Link>
          <div className="flex justify-between items-center text-sm p-3 bg-muted rounded-lg">
            <span>Créditos</span>
            <span className="font-bold text-lg text-primary">{appUser?.creditos ?? 0}</span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
      <div className="hidden lg:block border-r">
        <div className="flex flex-col h-full min-h-screen bg-card text-card-foreground">{sidebarContent}</div>
      </div>
      <div className="flex flex-col bg-background min-h-screen">
        <header className="flex min-h-16 shrink-0 items-center gap-3 border-b bg-card px-3 pt-[env(safe-area-inset-top,0px)] sm:gap-4 sm:px-6">
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
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-lg truncate">{headerTitle}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <ThemeToggle />
            <Link
              href="/dashboard/billetera"
              className="inline-flex md:hidden items-center gap-2 rounded-lg border bg-muted px-2.5 py-1.5 min-h-9 shrink-0"
              aria-label={`Billetera, ${appUser?.creditos ?? 0} créditos`}
            >
              <Wallet className="h-4 w-4 text-primary shrink-0" />
              <div className="flex flex-col items-start leading-none gap-0.5 min-w-[2.75rem]">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Créditos</span>
                <span className="font-bold tabular-nums text-sm text-primary">{appUser?.creditos ?? 0}</span>
              </div>
            </Link>
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
        <main className="flex-1 overflow-y-auto p-4 pb-[max(1rem,calc(1rem+env(safe-area-inset-bottom)))] md:p-8 md:pb-8">
          {children}
        </main>
      </div>

      <div className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom,1rem))] right-[max(1rem,env(safe-area-inset-right,1rem))] z-50 [&>*]:pointer-events-auto">
        <Link
          href="/admin/login"
          className="inline-flex items-center gap-2 px-3 py-2 text-xs bg-muted hover:bg-muted/80 text-muted-foreground rounded-lg transition-colors"
          aria-label="Ir al panel de administración"
        >
          <Settings className="h-3 w-3" />
          Admin
        </Link>
      </div>
    </div>
  );
}
