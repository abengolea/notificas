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
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AdminUser } from "@/lib/types"
import type { ColegioCollegeRow } from "@/lib/colegio-discount-types"
import { MoreHorizontal, ToggleLeft, Gift, XCircle, CheckCircle, Loader2, History, Scale, Pencil, Search, X } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"

type UserFilter = "todos" | "solo_cuenta"

const ALL_COLLEGES_VALUE = "__all__"

type HistorialRow = {
  id: string
  fecha: string
  tipo: string
  descripcion: string
  creditos: number
  monto: number
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function matchesFreeSearch(user: AdminUser, rawQuery: string): boolean {
  const q = normalizeForSearch(rawQuery);
  if (!q) return true;

  const haystack = normalizeForSearch(
    [
      user.nombre,
      user.email,
      user.id,
      user.colegioNombre ?? "",
      user.estado,
      user.colegioMemberEstado ?? "",
      String(user.enviosDisponibles),
      user.enNominaColegio ? "colegio nomina matriculado" : "",
      user.tieneCuentaNotificas ? "cuenta notificas" : "sin cuenta",
    ].join(" "),
  );

  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
}

function mapUser(u: Record<string, unknown>): AdminUser {
  return {
    id: String(u.id ?? ""),
    nombre: String(u.nombre ?? ""),
    email: String(u.email ?? ""),
    estado: u.estado === "suspendido" ? "suspendido" : "activo",
    enviosDisponibles: typeof u.enviosDisponibles === "number" ? u.enviosDisponibles : 0,
    fechaRegistro: new Date(typeof u.fechaRegistro === "string" ? u.fechaRegistro : 0),
    enNominaColegio: u.enNominaColegio === true,
    colegioId: typeof u.colegioId === "string" ? u.colegioId : undefined,
    colegioNombre: typeof u.colegioNombre === "string" ? u.colegioNombre : undefined,
    colegioMemberEstado:
      u.colegioMemberEstado === "suspendido" ? "suspendido" : u.colegioMemberEstado === "activo" ? "activo" : undefined,
    tieneCuentaNotificas: u.tieneCuentaNotificas !== false,
  }
}

export default function UserManagement() {
    const [users, setUsers] = React.useState<AdminUser[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [listError, setListError] = React.useState<string | null>(null);
    const [filter, setFilter] = React.useState<UserFilter>("todos");
    const [collegeFilter, setCollegeFilter] = React.useState(ALL_COLLEGES_VALUE);
    const [colleges, setColleges] = React.useState<ColegioCollegeRow[]>([]);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [colegioNombre, setColegioNombre] = React.useState<string | null>(null);
    const [selectedUser, setSelectedUser] = React.useState<AdminUser | null>(null);
    const [isGiftDialogOpen, setGiftDialogOpen] = React.useState(false);
    const [isEditEnviosOpen, setEditEnviosOpen] = React.useState(false);
    const [editEnviosValue, setEditEnviosValue] = React.useState(0);
    const [isHistorialOpen, setHistorialOpen] = React.useState(false);
    const [historial, setHistorial] = React.useState<HistorialRow[]>([]);
    const [historialLoading, setHistorialLoading] = React.useState(false);
    const [historialNote, setHistorialNote] = React.useState<string | null>(null);
    const [giftAmount, setGiftAmount] = React.useState(0);
    const [actionBusyId, setActionBusyId] = React.useState<string | null>(null);
    const { toast } = useToast();

    const loadUsers = React.useCallback(async () => {
        setListError(null);
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (collegeFilter !== ALL_COLLEGES_VALUE) {
                params.set("filter", "colegio");
                params.set("collegeId", collegeFilter);
            } else {
                params.set("filter", filter);
            }
            const res = await fetch(`/api/admin/users?${params}`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setListError(typeof data.error === "string" ? data.error : "No se pudo cargar la lista");
                setUsers([]);
                return;
            }
            const raw = Array.isArray(data.users) ? data.users : [];
            setUsers(raw.map((u: Record<string, unknown>) => mapUser(u)));
            setColegioNombre(typeof data.colegioNombre === "string" ? data.colegioNombre : null);
        } catch {
            setListError("Error de red al cargar usuarios");
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [filter, collegeFilter]);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/admin/colegio-discount/colleges", {
                    credentials: "include",
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || cancelled) return;
                const rows = Array.isArray(data.colleges) ? data.colleges : [];
                setColleges(
                    rows
                        .map((c: Record<string, unknown>) => ({
                            id: String(c.id ?? ""),
                            nombreColegio: String(c.nombreColegio ?? ""),
                            enabled: c.enabled === true,
                            discountPercent: typeof c.discountPercent === "number" ? c.discountPercent : 0,
                            memberCount: typeof c.memberCount === "number" ? c.memberCount : 0,
                            legalmevColegioId:
                                typeof c.legalmevColegioId === "string" ? c.legalmevColegioId : undefined,
                            legalmevMemberCount:
                                typeof c.legalmevMemberCount === "number" ? c.legalmevMemberCount : undefined,
                        }))
                        .filter((c: ColegioCollegeRow) => c.id && c.nombreColegio)
                        .sort((a: ColegioCollegeRow, b: ColegioCollegeRow) =>
                            a.nombreColegio.localeCompare(b.nombreColegio, "es"),
                        ),
                );
            } catch {
                /* sin colegios en selector */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        void loadUsers();
    }, [loadUsers]);

    const filteredUsers = React.useMemo(() => {
      const list = users.filter((u) => matchesFreeSearch(u, searchQuery));
      return [...list].sort(
        (a, b) => b.fechaRegistro.getTime() - a.fechaRegistro.getTime(),
      );
    }, [users, searchQuery]);

    const viewingCollege = collegeFilter !== ALL_COLLEGES_VALUE;
    const selectedCollege = colleges.find((c) => c.id === collegeFilter);

    const handleToggleSuspend = async (user: AdminUser) => {
        if (!user.id) return;
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

    const requireCuenta = (user: AdminUser): boolean => {
        if (!user.id) {
            toast({
                title: "Sin cuenta Notificas",
                description: "Este matriculado aún no se registró en la app.",
                variant: "destructive",
            });
            return false;
        }
        return true;
    };

    const handleOpenGiftDialog = (user: AdminUser) => {
        if (!requireCuenta(user)) return;
        setSelectedUser(user);
        setGiftAmount(0);
        setGiftDialogOpen(true);
    };

    const handleOpenEditEnvios = (user: AdminUser) => {
        if (!requireCuenta(user)) return;
        setSelectedUser(user);
        setEditEnviosValue(user.enviosDisponibles);
        setEditEnviosOpen(true);
    };

    const handleConfirmEditEnvios = async () => {
        if (!selectedUser?.id) return;
        if (editEnviosValue < 0 || !Number.isFinite(editEnviosValue)) {
            toast({
                title: "Valor inválido",
                description: "Los envíos deben ser un número mayor o igual a 0.",
                variant: "destructive",
            });
            return;
        }

        setActionBusyId(selectedUser.id);
        try {
            const res = await fetch("/api/admin/users", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    uid: selectedUser.id,
                    setEnvios: Math.floor(editEnviosValue),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast({
                    title: "No se pudo guardar",
                    description: typeof data.error === "string" ? data.error : "Intentá de nuevo",
                    variant: "destructive",
                });
                return;
            }
            const nuevo =
              typeof data.enviosDisponibles === "number"
                ? data.enviosDisponibles
                : Math.floor(editEnviosValue);
            toast({
                title: "Envíos actualizados",
                description: `${selectedUser.nombre}: ahora tiene ${nuevo} envío${nuevo === 1 ? "" : "s"}.`,
            });
            setEditEnviosOpen(false);
            setSelectedUser(null);
            await loadUsers();
        } finally {
            setActionBusyId(null);
        }
    };

    const handleOpenHistorial = async (user: AdminUser) => {
        setSelectedUser(user);
        setHistorial([]);
        setHistorialNote(null);
        setHistorialOpen(true);
        setHistorialLoading(true);
        try {
            const q = user.id
              ? `uid=${encodeURIComponent(user.id)}`
              : `email=${encodeURIComponent(user.email)}`;
            const res = await fetch(`/api/admin/users/historial?${q}`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setHistorialNote(typeof data.error === "string" ? data.error : "No se pudo cargar");
                return;
            }
            if (data.sinCuenta) {
                setHistorialNote(
                    typeof data.message === "string"
                      ? data.message
                      : "Sin cuenta Notificas — no hay movimientos.",
                );
                return;
            }
            const rows = Array.isArray(data.historial) ? data.historial : [];
            setHistorial(
              rows.map((h: Record<string, unknown>) => ({
                id: String(h.id ?? ""),
                fecha: String(h.fecha ?? ""),
                tipo: String(h.tipo ?? ""),
                descripcion: String(h.descripcion ?? ""),
                creditos: typeof h.creditos === "number" ? h.creditos : 0,
                monto: typeof h.monto === "number" ? h.monto : 0,
              })),
            );
            if (rows.length === 0) {
                setHistorialNote("Sin movimientos registrados todavía.");
            }
        } catch {
            setHistorialNote("Error de red al cargar el historial.");
        } finally {
            setHistorialLoading(false);
        }
    };

    const handleConfirmGift = async () => {
        if (!selectedUser?.id || giftAmount <= 0) {
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
                description: `Se sumaron ${giftAmount} envíos a ${selectedUser.nombre}.`,
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Usuarios
            </CardTitle>
            <CardDescription className="mt-1.5 max-w-2xl">
              Por defecto se listan todas las cuentas Notificas, del registro más reciente al más antiguo.
              Usá el filtro de colegio para ver la nómina de un convenio puntual (LegalMev o lista cargada).
            </CardDescription>
          </div>
          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as UserFilter)}
          >
            <TabsList>
              <TabsTrigger value="todos" disabled={viewingCollege}>
                Todos
              </TabsTrigger>
              <TabsTrigger value="solo_cuenta" disabled={viewingCollege}>
                Solo Notificas
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1.5 sm:min-w-[280px]">
            <Label htmlFor="college-filter" className="text-xs text-muted-foreground">
              Colegio con convenio
            </Label>
            <Select value={collegeFilter} onValueChange={setCollegeFilter}>
              <SelectTrigger id="college-filter" className="w-full sm:w-[320px]">
                <SelectValue placeholder="Todos los colegios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_COLLEGES_VALUE}>Todos los colegios</SelectItem>
                {colleges.map((college) => (
                  <SelectItem key={college.id} value={college.id}>
                    {college.nombreColegio}
                    {!college.enabled ? " (inactivo)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {viewingCollege && (colegioNombre || selectedCollege) ? (
          <p className="text-sm text-primary font-medium">
            Nómina: {colegioNombre ?? selectedCollege?.nombreColegio} — {users.length} fila
            {users.length === 1 ? "" : "s"}
          </p>
        ) : !viewingCollege ? (
          <p className="text-sm text-muted-foreground">
            {users.length} cuenta{users.length === 1 ? "" : "s"} Notificas · ordenadas por registro (más nuevas primero)
          </p>
        ) : null}
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Buscar por nombre, email, UID, envíos, colegio…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
            aria-label="Buscar usuarios"
            disabled={loading}
          />
          {searchQuery ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
              aria-label="Limpiar búsqueda"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        {searchQuery.trim() && !loading && !listError ? (
          <p className="text-sm text-muted-foreground">
            {filteredUsers.length} de {users.length} coinciden con «{searchQuery.trim()}»
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando…
          </div>
        ) : listError ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {listError}
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => { void loadUsers(); }}>
              Reintentar
            </Button>
          </div>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {viewingCollege
              ? "No hay matriculados en la nómina de este colegio. Vinculá LegalMev o cargá la lista en Planes → Colegios."
              : "No hay usuarios para mostrar."}
          </p>
        ) : filteredUsers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Ningún usuario coincide con «{searchQuery.trim()}». Probá con otro término o limpiá el buscador.
          </p>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Colegio / cuenta</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Envíos</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id || user.email}>
                <TableCell>
                  <div className="font-medium">{user.nombre}</div>
                  <div className="text-sm text-muted-foreground">
                    {user.email}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {user.enNominaColegio ? (
                      <Badge variant="secondary" className="w-fit text-xs">
                        {user.colegioNombre ?? "Colegio"}
                        {user.colegioMemberEstado === "suspendido" ? " (nómina suspendido)" : ""}
                      </Badge>
                    ) : null}
                    {user.tieneCuentaNotificas ? (
                      <Badge variant="outline" className="w-fit text-xs">Cuenta Notificas</Badge>
                    ) : (
                      <Badge variant="destructive" className="w-fit text-xs">Sin cuenta Notificas</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.estado === "activo" ? "default" : "destructive"}>
                    <div className="flex items-center">
                        {user.estado === "activo" ? <CheckCircle className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                        {user.tieneCuentaNotificas ? user.estado : user.colegioMemberEstado ?? user.estado}
                    </div>
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.tieneCuentaNotificas ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono tabular-nums text-sm hover:bg-muted"
                      title="Clic para editar envíos disponibles"
                      onClick={() => handleOpenEditEnvios(user)}
                    >
                      {user.enviosDisponibles}
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {user.tieneCuentaNotificas && user.fechaRegistro.getTime() > 0
                    ? format(user.fechaRegistro, "dd/MM/yyyy", { locale: es })
                    : "—"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Menú</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => void handleOpenHistorial(user)}>
                        <History className="mr-2 h-4 w-4" />
                        Historial de movimientos
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={!user.id || actionBusyId === user.id}
                        onClick={() => handleOpenEditEnvios(user)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar envíos disponibles
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!user.id || actionBusyId === user.id}
                        onClick={() => handleOpenGiftDialog(user)}>
                        <Gift className="mr-2 h-4 w-4" />
                        Sumar envíos (regalo)
                      </DropdownMenuItem>
                      {user.id && user.estado === 'activo' ? (
                         <DropdownMenuItem
                           className="text-destructive"
                           disabled={actionBusyId === user.id}
                           onClick={() => void handleToggleSuspend(user)}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Suspender cuenta
                         </DropdownMenuItem>
                      ) : user.id ? (
                        <DropdownMenuItem
                          disabled={actionBusyId === user.id}
                          onClick={() => void handleToggleSuspend(user)}>
                            <ToggleLeft className="mr-2 h-4 w-4" />
                            Reanudar cuenta
                        </DropdownMenuItem>
                      ) : null}
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

    <Dialog open={isEditEnviosOpen} onOpenChange={setEditEnviosOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Editar envíos — {selectedUser?.nombre}</DialogTitle>
                <DialogDescription>
                  Definí el saldo exacto de envíos en la billetera (reemplaza el valor actual, no suma).
                  Útil si antes eran créditos en pesos y hay que corregir la migración.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="edit-envios">Envíos disponibles</Label>
                    <Input
                        id="edit-envios"
                        type="number"
                        min={0}
                        step={1}
                        value={editEnviosValue}
                        onChange={(e) => setEditEnviosValue(parseInt(e.target.value, 10) || 0)}
                    />
                    {selectedUser ? (
                      <p className="text-xs text-muted-foreground">
                        Valor actual en sistema: <strong>{selectedUser.enviosDisponibles}</strong>
                      </p>
                    ) : null}
                </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditEnviosOpen(false)}>Cancelar</Button>
                <Button type="button" disabled={actionBusyId === selectedUser?.id} onClick={() => void handleConfirmEditEnvios()}>
                  {actionBusyId === selectedUser?.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    "Guardar envíos"
                  )}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <Dialog open={isGiftDialogOpen} onOpenChange={setGiftDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Sumar envíos — {selectedUser?.nombre}</DialogTitle>
                <DialogDescription>
                    Suma envíos al saldo actual (no reemplaza). Para fijar un número exacto usá «Editar envíos».
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="gift-amount">Cantidad de envíos</Label>
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

    <Dialog open={isHistorialOpen} onOpenChange={setHistorialOpen}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Historial — {selectedUser?.nombre}</DialogTitle>
                <DialogDescription>{selectedUser?.email}</DialogDescription>
            </DialogHeader>
            {historialLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : historialNote ? (
              <p className="text-sm text-muted-foreground py-4">{historialNote}</p>
            ) : (
              <div className="max-h-[360px] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead className="text-right">Envíos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historial.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {h.fecha ? format(new Date(h.fecha), "dd/MM/yy HH:mm", { locale: es }) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{h.tipo}</TableCell>
                        <TableCell className="text-xs max-w-[180px] truncate" title={h.descripcion}>
                          {h.descripcion}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {h.creditos > 0 ? `+${h.creditos}` : h.creditos}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setHistorialOpen(false)}>Cerrar</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  )
}
