"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { LogOut, User as UserIcon } from "lucide-react"

import type { User } from "@/lib/types"
import { auth } from "@/lib/firebase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface UserNavProps {
  user: User;
  /** Omit to keep the particulares account link. Pass `null` to hide it. */
  accountHref?: string | null;
  /** Avatar plus name as the trigger (ART / empresa shell). */
  showName?: boolean;
}

export function UserNav({ user, accountHref = "/dashboard/cuenta", showName = false }: UserNavProps) {
  const router = useRouter()

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[1][0]}`;
    }
    return name.substring(0, 2);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={showName ? "h-9 max-w-[16rem] gap-2 rounded-md px-1.5" : "relative h-10 w-10 rounded-full"}
          aria-label="Menú de usuario"
        >
          <Avatar className={showName ? "h-8 w-8" : "h-10 w-10"}>
            <AvatarImage src={user.avatarUrl} alt={user.perfil.nombre} />
            <AvatarFallback>{getInitials(user.perfil.nombre)}</AvatarFallback>
          </Avatar>
          {showName ? (
            <span className="hidden min-w-0 flex-col items-start sm:flex">
              <span className="max-w-[10rem] truncate text-[13px] font-medium leading-4">{user.perfil.nombre}</span>
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.perfil.nombre}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        {accountHref ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href={accountHref}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Mi cuenta</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut(auth)
            router.push("/")
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Cerrar sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
