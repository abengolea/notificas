"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
  Search, 
  Mail, 
  Clock, 
  Send, 
  History, 
  UserPlus,
  MoreVertical,
  Filter,
  Pencil,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Contacto } from "@/lib/types"
import { obtenerContactos, buscarContactos } from "@/lib/contactos"
import { useToast } from "@/hooks/use-toast"
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth"
import { ComposeMessageDialog } from "@/components/dashboard/compose-message-dialog"
import { ContactoHistorial } from "@/components/dashboard/contacto-historial"
import { NuevoContactoDialog } from "@/components/dashboard/nuevo-contacto-dialog"
import { EditarContactoNombreDialog } from "@/components/dashboard/editar-contacto-nombre-dialog"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { ChevronLeft, Home } from "lucide-react"

export function ContactosPageComponent({ layout = "standalone" }: { layout?: "standalone" | "shell" }) {
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [contactosFiltrados, setContactosFiltrados] = useState<Contacto[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [cargando, setCargando] = useState(false)
  const [isComposeOpen, setComposeOpen] = useState(false)
  const [contactoSeleccionado, setContactoSeleccionado] = useState<Contacto | null>(null)
  const [isHistorialOpen, setIsHistorialOpen] = useState(false)
  const [contactoHistorial, setContactoHistorial] = useState<Contacto | null>(null)
  const [isNuevoContactoOpen, setIsNuevoContactoOpen] = useState(false)
  const [contactoEditando, setContactoEditando] = useState<Contacto | null>(null)
  const { toast } = useToast()
  const { user } = useFirebaseAuth()

  const cargarContactos = async () => {
    if (!user?.uid) return
    
    setCargando(true)
    try {
      const contactosData = await obtenerContactos(user.uid, 100)
      setContactos(contactosData)
      setContactosFiltrados(contactosData)
    } catch (error) {
      console.error('Error al cargar contactos:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los contactos",
        variant: "destructive"
      })
    } finally {
      setCargando(false)
    }
  }

  const buscarContactosHandler = async (termino: string) => {
    if (!user?.uid) return
    
    setBusqueda(termino)
    
    if (termino.trim() === "") {
      setContactosFiltrados(contactos)
      return
    }

    try {
      const resultados = await buscarContactos(user.uid, termino, 50)
      setContactosFiltrados(resultados)
    } catch (error) {
      console.error('Error al buscar contactos:', error)
      setContactosFiltrados([])
    }
  }

  const abrirCompose = (contacto?: Contacto) => {
    setContactoSeleccionado(contacto || null)
    setComposeOpen(true)
  }

  const cerrarCompose = () => {
    setComposeOpen(false)
    setContactoSeleccionado(null)
  }

  const abrirHistorial = (contacto: Contacto) => {
    setContactoHistorial(contacto)
    setIsHistorialOpen(true)
  }

  const cerrarHistorial = () => {
    setIsHistorialOpen(false)
    setContactoHistorial(null)
  }

  const abrirNuevoContacto = () => {
    setIsNuevoContactoOpen(true)
  }

  const cerrarNuevoContacto = () => {
    setIsNuevoContactoOpen(false)
  }

  const handleContactoAgregado = () => {
    cargarContactos() // Recargar la lista de contactos
  }

  const getIniciales = (email: string, nombre?: string) => {
    if (nombre && nombre !== email.split('@')[0]) {
      return nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email.split('@')[0].slice(0, 2).toUpperCase()
  }

  const getFrecuenciaTexto = (vecesUsado: number) => {
    if (vecesUsado === 1) return "1 vez"
    if (vecesUsado < 5) return `${vecesUsado} veces`
    if (vecesUsado < 10) return `${vecesUsado} veces (frecuente)`
    return `${vecesUsado} veces (muy frecuente)`
  }

  const getFrecuenciaColor = (vecesUsado: number) => {
    if (vecesUsado === 1) return "bg-muted text-muted-foreground hover:bg-muted"
    if (vecesUsado < 5) return "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20"
    if (vecesUsado < 10) return "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/25"
    return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/25"
  }

  useEffect(() => {
    cargarContactos()
  }, [user?.uid])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      buscarContactosHandler(busqueda)
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [busqueda])

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando usuario...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          {layout === "shell" ? (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <Link href="/dashboard" className="flex items-center gap-1 hover:text-foreground transition-colors">
                  <Home className="h-3.5 w-3.5" />
                  Dashboard
                </Link>
                <ChevronLeft className="h-3 w-3 rotate-180 opacity-60" aria-hidden />
                <span className="font-medium text-foreground">Contactos</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Contactos</h1>
              <p className="text-sm text-muted-foreground">
                Gestiona tus contactos y envía mensajes certificados
              </p>
            </>
          ) : (
            <div className="flex items-start gap-4">
              <Link href="/" className="flex shrink-0 items-center gap-2 hover:opacity-80 transition-opacity">
                <Logo className="h-8 w-auto" />
              </Link>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mb-1">
                  <Link href="/dashboard" className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Home className="h-3 w-3" />
                    Dashboard
                  </Link>
                  <ChevronLeft className="h-3 w-3 rotate-180 opacity-60" aria-hidden />
                  <span className="font-medium text-foreground">Contactos</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Contactos</h1>
                <p className="text-muted-foreground">
                  Gestiona tus contactos y envía mensajes certificados
                </p>
              </div>
            </div>
          )}
        </div>
        <Button onClick={abrirNuevoContacto} className="shrink-0 w-full sm:w-auto">
          <UserPlus className="mr-2 h-4 w-4" />
          Nuevo Contacto
        </Button>
      </div>

      {/* Métricas rápidas */}
      {contactos.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="border-border/80 shadow-sm">
            <CardContent className="flex items-center justify-between gap-3 pt-4 pb-4">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="text-2xl font-bold tabular-nums text-primary">{contactos.length}</span>
            </CardContent>
          </Card>
          <Card className="border-border/80 shadow-sm">
            <CardContent className="flex items-center justify-between gap-3 pt-4 pb-4">
              <span className="text-sm font-medium text-muted-foreground">Activos</span>
              <span className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {contactos.filter((c) => c.vecesUsado > 1).length}
              </span>
            </CardContent>
          </Card>
          <Card className="border-border/80 shadow-sm">
            <CardContent className="flex items-center justify-between gap-3 pt-4 pb-4">
              <span className="text-sm font-medium text-muted-foreground">Envíos registrados</span>
              <span className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {contactos.reduce((sum, c) => sum + c.vecesUsado, 0)}
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Búsqueda */}
      <Card className="border-border/80 shadow-sm">
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por email o nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10"
              aria-label="Buscar contactos"
            />
          </div>
          <Button variant="outline" onClick={cargarContactos} disabled={cargando} className="shrink-0">
            <Filter className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </CardContent>
      </Card>

      {/* Lista */}
      {cargando ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
        </div>
      ) : contactosFiltrados.length === 0 ? (
        <Card className="border-border/80">
          <CardContent className="py-12">
            <div className="text-center">
              <Mail className="mx-auto h-12 w-12 text-muted-foreground opacity-60" />
              <h3 className="mt-3 text-sm font-semibold text-foreground">
                {busqueda ? "No se encontraron contactos" : "No tienes contactos aún"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {busqueda
                  ? "Probá con otro término de búsqueda"
                  : "Enviá tu primer mensaje para comenzar a crear contactos"}
              </p>
              {!busqueda && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Button onClick={abrirNuevoContacto}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Agregar contacto
                  </Button>
                  <Button variant="outline" onClick={() => abrirCompose()}>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar mensaje
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b bg-muted/30 py-3">
            <CardTitle className="text-base font-semibold">Lista de contactos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {contactosFiltrados.map((contacto) => (
                <li
                  key={contacto.id}
                  className="flex flex-col gap-4 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Avatar className="h-11 w-11 shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {getIniciales(contacto.email, contacto.nombre)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-medium text-foreground">
                          {contacto.nombre && contacto.nombre !== contacto.email.split("@")[0]
                            ? contacto.nombre
                            : contacto.email.split("@")[0]}
                        </h3>
                        <Badge variant="outline" className={getFrecuenciaColor(contacto.vecesUsado)}>
                          {getFrecuenciaTexto(contacto.vecesUsado)}
                        </Badge>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">{contacto.email}</p>
                      {contacto.cuit ? (
                        <p className="text-xs text-muted-foreground">CUIT: {contacto.cuit}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          Último uso: {format(contacto.ultimoUso, "dd/MM/yyyy", { locale: es })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3 shrink-0" />
                          Creado: {format(contacto.createdAt, "dd/MM/yyyy", { locale: es })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-end gap-2 sm:pl-2">
                    <Button size="sm" onClick={() => abrirCompose(contacto)}>
                      <Send className="mr-2 h-4 w-4" />
                      Enviar
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Más opciones">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setContactoEditando(contacto)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar nombre
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => abrirCompose(contacto)}>
                          <Send className="mr-2 h-4 w-4" />
                          Enviar mensaje
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => abrirHistorial(contacto)}>
                          <History className="mr-2 h-4 w-4" />
                          Ver historial
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Diálogo de redactar mensaje */}
      {user && (
        <>
          <ComposeMessageDialog
            open={isComposeOpen}
            onOpenChange={cerrarCompose}
            user={{
              uid: user.uid,
              email: user.email || '',
              tipo: 'individual',
              estado: 'activo',
              perfil: { nombre: user.displayName || user.email || 'Usuario', verificado: true },
              createdAt: new Date(),
              lastLogin: new Date(),
              avatarUrl: user.photoURL || undefined,
              creditos: 0,
            }}
            initialContact={contactoSeleccionado ? { email: contactoSeleccionado.email, nombre: contactoSeleccionado.nombre, telefono: contactoSeleccionado.telefono } : undefined}
          >
            <div />
          </ComposeMessageDialog>

          {/* Diálogo de historial */}
          {contactoHistorial && (
            <ContactoHistorial
              contacto={contactoHistorial}
              isOpen={isHistorialOpen}
              onClose={cerrarHistorial}
              userEmail={user.email || ''}
            />
          )}

          {/* Diálogo de nuevo contacto */}
          <NuevoContactoDialog
            open={isNuevoContactoOpen}
            onOpenChange={cerrarNuevoContacto}
            user={{
              uid: user.uid,
              email: user.email || '',
              tipo: 'individual',
              estado: 'activo',
              perfil: { nombre: user.displayName || user.email || 'Usuario', verificado: true },
              createdAt: new Date(),
              lastLogin: new Date(),
              avatarUrl: user.photoURL || undefined,
              creditos: 0,
            }}
            onContactoAgregado={handleContactoAgregado}
          />

          <EditarContactoNombreDialog
            open={contactoEditando !== null}
            onOpenChange={(open) => {
              if (!open) setContactoEditando(null)
            }}
            contacto={contactoEditando}
            onActualizado={() => {
              void cargarContactos()
            }}
          />
        </>
      )}
    </div>
  )
}
