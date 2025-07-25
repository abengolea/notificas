"use client"

import * as React from "react"
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AdminUser } from "@/lib/types"
import { MoreHorizontal, ToggleLeft, Gift, XCircle, CheckCircle } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"

interface UserManagementProps {
  users: AdminUser[]
}

export default function UserManagement({ users: initialUsers }: UserManagementProps) {
    const [users, setUsers] = React.useState<AdminUser[]>(initialUsers);
    const [selectedUser, setSelectedUser] = React.useState<AdminUser | null>(null);
    const [isGiftDialogOpen, setGiftDialogOpen] = React.useState(false);
    const [giftAmount, setGiftAmount] = React.useState(0);
    const { toast } = useToast();

    const handleToggleSuspend = (userId: string) => {
        setUsers(prevUsers => {
            const updatedUsers = prevUsers.map(user => {
                if (user.id === userId) {
                    const newStatus = user.estado === 'activo' ? 'suspendido' : 'activo';
                    toast({
                        title: `Usuario ${newStatus === 'activo' ? 'Reanudado' : 'Suspendido'}`,
                        description: `El usuario ${user.nombre} ha sido ${newStatus === 'activo' ? 'reanudado' : 'suspendido'}.`,
                    });
                    return { ...user, estado: newStatus };
                }
                return user;
            });
            return updatedUsers;
        });
    };

    const handleOpenGiftDialog = (user: AdminUser) => {
        setSelectedUser(user);
        setGiftAmount(0);
        setGiftDialogOpen(true);
    };

    const handleConfirmGift = () => {
        if (!selectedUser || giftAmount <= 0) {
            toast({
                title: 'Error',
                description: 'Por favor, introduce una cantidad válida de envíos.',
                variant: 'destructive',
            });
            return;
        }

        setUsers(prevUsers => 
            prevUsers.map(user => 
                user.id === selectedUser.id 
                    ? { ...user, enviosDisponibles: user.enviosDisponibles + giftAmount }
                    : user
            )
        );

        toast({
            title: '¡Envíos Regalados!',
            description: `Se han añadido ${giftAmount} envíos a ${selectedUser.nombre}.`,
        });

        setGiftDialogOpen(false);
        setSelectedUser(null);
    };


  return (
    <>
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
                    <div className="flex items-center">
                        {user.estado === "activo" ? <CheckCircle className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                        {user.estado}
                    </div>
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
                      <DropdownMenuItem onClick={() => handleOpenGiftDialog(user)}>
                        <Gift className="mr-2 h-4 w-4" />
                        Regalar Envíos
                      </DropdownMenuItem>
                      {user.estado === 'activo' ? (
                         <DropdownMenuItem className="text-destructive" onClick={() => handleToggleSuspend(user.id)}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Suspender
                         </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => handleToggleSuspend(user.id)}>
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

    <Dialog open={isGiftDialogOpen} onOpenChange={setGiftDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Regalar Envíos a {selectedUser?.nombre}</DialogTitle>
                <DialogDescription>
                    Introduce la cantidad de envíos que quieres añadir a la cuenta de este usuario.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="gift-amount">Cantidad de Envíos</Label>
                    <Input
                        id="gift-amount"
                        type="number"
                        value={giftAmount}
                        onChange={(e) => setGiftAmount(parseInt(e.target.value, 10) || 0)}
                        placeholder="Ej: 10"
                    />
                </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setGiftDialogOpen(false)}>Cancelar</Button>
                <Button type="button" onClick={handleConfirmGift}>Confirmar Regalo</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  )
}
