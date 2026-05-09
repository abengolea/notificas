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
import { MoreHorizontal, ToggleLeft, Gift, XCircle, CheckCircle, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"

export default function UserManagement() {
    const [users, setUsers] = React.useState<AdminUser[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [listError, setListError] = React.useState<string | null>(null);
    const [selectedUser, setSelectedUser] = React.useState<AdminUser | null>(null);
    const [isGiftDialogOpen, setGiftDialogOpen] = React.useState(false);
    const [giftAmount, setGiftAmount] = React.useState(0);
    const [actionBusyId, setActionBusyId] = React.useState<string | null>(null);
    const { toast } = useToast();

    const loadUsers = React.useCallback(async () => {
        setListError(null);
        try {
            const res = await fetch("/api/admin/users", { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setListError(typeof data.error === "string" ? data.error : "No se pudo cargar la lista");
                setUsers([]);
                return;
            }
            const raw = Array.isArray(data.users) ? data.users : [];
            const mapped: AdminUser[] = raw.map((u: Record<string, unknown>) => ({
                id: String(u.id ?? ""),
                nombre: String(u.nombre ?? ""),
                email: String(u.email ?? ""),
                estado: u.estado === "suspendido" ? "suspendido" : "activo",
                enviosDisponibles: typeof u.enviosDisponibles === "number" ? u.enviosDisponibles : 0,
                fechaRegistro: new Date(typeof u.fechaRegistro === "string" ? u.fechaRegistro : 0),
            }));
            setUsers(mapped);
        } catch {
            setListError("Error de red al cargar usuarios");
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadUsers();
    }, [loadUsers]);

    const handleToggleSuspend = async (user: AdminUser) => {
        const newStatus = user.estado === "activo" ? "suspendido" : "activo";
        setActionBusyId(user.id);
        try {
            const res = await fetch("/api/admin/users", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uid: user.id, estado: newStatus }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast({
                    title: "No se pudo actualizar",
                    description: typeof data.error === "string" ? data.error : "Intentá de nuevo",
                    variant: "destructive",
                });
                return;
            }
            toast({
                title: newStatus === "activo" ? "Usuario reanudado" : "Usuario suspendido",
                description: `${user.nombre}: cuenta ${newStatus}.`,
            });
            await loadUsers();
        } finally {
            setActionBusyId(null);
        }
    };

    const handleOpenGiftDialog = (user: AdminUser) => {
        setSelectedUser(user);
        setGiftAmount(0);
        setGiftDialogOpen(true);
    };

    const handleConfirmGift = async () => {
        if (!selectedUser || giftAmount <= 0) {
            toast({
                title: 'Error',
                description: 'Por favor, introduce una cantidad válida de envíos.',
                variant: 'destructive',
            });
            return;
        }

        setActionBusyId(selectedUser.id);
        try {
            const res = await fetch("/api/admin/users", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uid: selectedUser.id, addCreditos: giftAmount }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast({
                    title: "No se pudo regalar envíos",
                    description: typeof data.error === "string" ? data.error : "Intentá de nuevo",
                    variant: "destructive",
                });
                return;
            }
            toast({
                title: '¡Envíos regalados!',
                description: `Se sumaron ${giftAmount} envíos (créditos) a ${selectedUser.nombre}.`,
            });
            setGiftDialogOpen(false);
            setSelectedUser(null);
            await loadUsers();
        } finally {
            setActionBusyId(null);
        }
    };


  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Usuarios</CardTitle>
        <CardDescription>
          Usuarios con perfil en Firestore (colección <code className="text-xs">users</code>). Quienes solo existan en Auth sin documento no aparecen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando usuarios…
          </div>
        ) : listError ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {listError}
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => { setLoading(true); void loadUsers(); }}>
              Reintentar
            </Button>
          </div>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay documentos en <code className="text-xs">users</code>. Los registros por signup crean el perfil aquí.
          </p>
        ) : (
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
                      <DropdownMenuItem
                        disabled={actionBusyId === user.id}
                        onClick={() => handleOpenGiftDialog(user)}>
                        <Gift className="mr-2 h-4 w-4" />
                        Regalar Envíos
                      </DropdownMenuItem>
                      {user.estado === 'activo' ? (
                         <DropdownMenuItem
                           className="text-destructive"
                           disabled={actionBusyId === user.id}
                           onClick={() => void handleToggleSuspend(user)}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Suspender
                         </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          disabled={actionBusyId === user.id}
                          onClick={() => void handleToggleSuspend(user)}>
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
        )}
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
                <Button type="button" disabled={actionBusyId === selectedUser?.id} onClick={() => void handleConfirmGift()}>
                  {actionBusyId === selectedUser?.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    "Confirmar regalo"
                  )}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  )
}
