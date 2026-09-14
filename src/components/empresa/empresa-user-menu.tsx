"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { User as AppUser } from "@/lib/types";
import { UserNav } from "@/components/dashboard/user-nav";
import { ThemeToggle } from "@/components/theme-toggle";
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
}: {
  className?: string;
}) {
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(mapAuthUser(u)));
    return () => unsub();
  }, []);

  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <ThemeToggle />
      {user ? <UserNav user={user} accountHref="/dashboard/cuenta" showName /> : null}
    </div>
  );
}
