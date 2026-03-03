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
  Filter
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
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { ChevronLeft, Home } from "lucide-react"

export function ContactosPageComponent() {
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [contactosFiltrados, setContactosFiltrados] = useState<Contacto[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [cargando, setCargando] = useState(false)
  const [isComposeOpen, setComposeOpen] = useState(false)
  const [contactoSeleccionado, setContactoSeleccionado] = useState<Contacto | null>(null)
  const [isHistorialOpen, setIsHistorialOpen] = useState(false)
  const [contactoHistorial, setContactoHistorial] = useState<Contacto | null>(null)
  const [isNuevoContactoOpen, setIsNuevoContactoOpen] = useState(false)
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
    if (vecesUsado === 1) return "bg-gray-100 text-gray-600"
    if (vecesUsado < 5) return "bg-blue-100 text-blue-600"
    if (vecesUsado < 10) return "bg-orange-100 text-orange-600"
    return "bg-green-100 text-green-600"
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
    <div className="space-y-6">
      {/* Header con navegación */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Logo className="h-8 w-auto" />
          </Link>
          <div className="h-8 w-px bg-border"></div>
          <div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
              <Link href="/dashboard" className="flex items-center gap-1 hover:text-foreground transition-colors">
                <Home className="h-3 w-3" />
                Dashboard
              </Link>
              <ChevronLeft className="h-3 w-3 rotate-180" />
              <span className="text-foreground font-medium">Contactos</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Contactos</h1>
            <p className="text-muted-foreground">
              Gestiona tus contactos y envía mensajes certificados
            </p>
          </div>
        </div>
        <Button onClick={abrirNuevoContacto}>
          <UserPlus className="mr-2 h-4 w-4" />
          Nuevo Contacto
        </Button>
      </div>

      {/* Barra de búsqueda y filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar por email o nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={cargarContactos} disabled={cargando}>
              <Filter className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de contactos */}
      <div className="grid gap-4">
        {cargando ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : contactosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Mail className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {busqueda ? 'No se encontraron contactos' : 'No tienes contactos aún'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {busqueda 
                    ? 'Intenta con otros términos de búsqueda'
                    : 'Envía tu primer mensaje para comenzar a crear contactos'
                  }
                </p>
                {!busqueda && (
                  <div className="mt-6 space-x-2">
                    <Button onClick={abrirNuevoContacto}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Agregar Contacto
                    </Button>
                    <Button variant="outline" onClick={() => abrirCompose()}>
                      <Send className="mr-2 h-4 w-4" />
                      Enviar Mensaje
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          contactosFiltrados.map((contacto) => (
            <Card key={contacto.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getIniciales(contacto.email, contacto.nombre)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {contacto.nombre && contacto.nombre !== contacto.email.split('@')[0] 
                            ? contacto.nombre 
                            : contacto.email.split('@')[0]
                          }
                        </h3>
                        <Badge className={getFrecuenciaColor(contacto.vecesUsado)}>
                          {getFrecuenciaTexto(contacto.vecesUsado)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{contacto.email}</p>
                      {contacto.cuit && (
                        <p className="text-xs text-gray-400">CUIT: {contacto.cuit}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-1">
                        <div className="flex items-center text-xs text-gray-400">
                          <Clock className="mr-1 h-3 w-3" />
                          Último uso: {format(contacto.ultimoUso, 'dd/MM/yyyy', { locale: es })}
                        </div>
                        <div className="flex items-center text-xs text-gray-400">
                          <Mail className="mr-1 h-3 w-3" />
                          Creado: {format(contacto.createdAt, 'dd/MM/yyyy', { locale: es })}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button 
                      size="sm" 
                      onClick={() => abrirCompose(contacto)}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Enviar
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => abrirCompose(contacto)}>
                          <Send className="mr-2 h-4 w-4" />
                          Enviar Mensaje
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => abrirHistorial(contacto)}>
                          <History className="mr-2 h-4 w-4" />
                          Ver Historial
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Estadísticas */}
      {contactos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Estadísticas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{contactos.length}</div>
                <div className="text-sm text-gray-500">Total Contactos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {contactos.filter(c => c.vecesUsado > 1).length}
                </div>
                <div className="text-sm text-gray-500">Contactos Activos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {contactos.reduce((sum, c) => sum + c.vecesUsado, 0)}
                </div>
                <div className="text-sm text-gray-500">Mensajes Enviados</div>
              </div>
            </div>
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
        </>
      )}
    </div>
  )
}
