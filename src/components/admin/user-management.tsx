"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AdminUser } from "@/lib/types"
import { MoreHorizontal, ToggleLeft, Gift, XCircle } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface UserManagementProps {
  users: AdminUser[]
}

export default function UserManagement({ users }: UserManagementProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios</CardTitle>
        <CardDescription>
          Gestiona los usuarios de la plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Envíos Disponibles</TableHead>
              <TableHead>Fecha de Registro</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="font-medium">{user.nombre}</div>
                  <div className="text-sm text-muted-foreground">
                    {user.email}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.estado === "activo" ? "default" : "destructive"}>
                    {user.estado}
                  </Badge>
                </TableCell>
                <TableCell>{user.enviosDisponibles}</TableCell>
                <TableCell>
                  {format(user.fechaRegistro, "dd/MM/yyyy", { locale: es })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuItem>
                        <Gift className="mr-2 h-4 w-4" />
                        Regalar Envíos
                      </DropdownMenuItem>
                      {user.estado === 'activo' ? (
                         <DropdownMenuItem className="text-destructive">
                            <XCircle className="mr-2 h-4 w-4" />
                            Suspender
                         </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem>
                            <ToggleLeft className="mr-2 h-4 w-4" />
                            Reanudar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
