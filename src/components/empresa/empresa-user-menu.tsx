"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { auth } from "@/lib/firebase";
import type { User as AppUser } from "@/lib/types";
import { UserNav } from "@/components/dashboard/user-nav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function mapAuthUser(u: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
} | null): AppUser | null {
  if (!u) return null;
  const email = u.email || "";
  return {
    uid: u.uid,
    email,
    tipo: "empresa",
    estado: "activo",
    perfil: { nombre: u.displayName || email || "Usuario", verificado: true },
    createdAt: new Date(),
    lastLogin: new Date(),
    avatarUrl: u.photoURL || undefined,
    creditos: 0,
  };
}

export function EmpresaUserMenu({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(mapAuthUser(u)));
    return () => unsub();
  }, []);

  if (!user) return null;

  async function handleSignOut() {
    await signOut(auth);
    router.push("/");
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2 sm:gap-3", className)}>
      {compact ? null : (
        <div className="hidden min-w-0 text-right sm:block">
          <p className="truncate text-sm font-medium leading-tight">{user.perfil.nombre}</p>
          {user.email && user.email !== user.perfil.nombre ? (
            <p className="truncate text-xs leading-tight text-muted-foreground">{user.email}</p>
          ) : null}
        </div>
      )}
      {compact ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={handleSignOut}
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden shrink-0 md:inline-flex"
          onClick={handleSignOut}
          aria-label="Cerrar sesión"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </Button>
      )}
      <UserNav user={user} accountHref={null} />
    </div>
  );
}
