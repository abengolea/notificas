"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
  X, 
  Mail, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Eye,
  Download,
  ExternalLink
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Contacto } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import Link from "next/link"

interface ContactoHistorialProps {
  contacto: Contacto
  isOpen: boolean
  onClose: () => void
  userEmail: string
}

interface MensajeHistorial {
  id: string
  subject: string
  createdAt: Date
  delivery: {
    state: string
    time: Date
  }
  tracking: {
    opened: boolean
    readConfirmed: boolean
    openCount: number
  }
  message: {
    html: string
  }
}

export function ContactoHistorial({ contacto, isOpen, onClose, userEmail }: ContactoHistorialProps) {
  const [mensajes, setMensajes] = useState<MensajeHistorial[]>([])
  const [cargando, setCargando] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!isOpen || !userEmail) return

    setCargando(true)
    
    // Buscar mensajes enviados a este contacto
    const mailCol = collection(db, 'mail')
    const q = query(
      mailCol,
      where('senderName', '==', userEmail),
      where('to', 'array-contains', contacto.email),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mensajesData: MensajeHistorial[] = []
      
      snapshot.forEach((doc) => {
        const data = doc.data()
        mensajesData.push({
          id: doc.id,
          subject: data.message?.subject || 'Sin asunto',
          createdAt: data.createdAt?.toDate() || new Date(),
          delivery: {
            state: data.delivery?.state || 'PENDING',
            time: data.delivery?.time?.toDate() || new Date()
          },
          tracking: {
            opened: data.tracking?.opened || false,
            readConfirmed: data.tracking?.readConfirmed || false,
            openCount: data.tracking?.openCount || 0
          },
          message: {
            html: data.message?.html || ''
          }
        })
      })
      
      setMensajes(mensajesData)
      setCargando(false)
    }, (error) => {
      console.error('Error al cargar historial:', error)
      setCargando(false)
      toast({
        title: "Error",
        description: "No se pudo cargar el historial de mensajes",
        variant: "destructive"
      })
    })

    return () => unsubscribe()
  }, [isOpen, userEmail, contacto.email])

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'DELIVERED':
        return 'bg-green-100 text-green-600'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-600'
      case 'ERROR':
        return 'bg-red-100 text-red-600'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  const getEstadoTexto = (estado: string) => {
    switch (estado) {
      case 'DELIVERED':
        return 'Entregado'
      case 'PENDING':
        return 'Pendiente'
      case 'ERROR':
        return 'Error'
      default:
        return estado
    }
  }

  const getIniciales = (email: string, nombre?: string) => {
    if (nombre && nombre !== email.split('@')[0]) {
      return nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email.split('@')[0].slice(0, 2).toUpperCase()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getIniciales(contacto.email, contacto.nombre)}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-xl">
                  {contacto.nombre && contacto.nombre !== contacto.email.split('@')[0] 
                    ? contacto.nombre 
                    : contacto.email.split('@')[0]
                  }
                </DialogTitle>
                <p className="text-sm text-muted-foreground">{contacto.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {cargando ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : mensajes.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Mail className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No hay mensajes enviados
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Aún no has enviado mensajes a este contacto
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            mensajes.map((mensaje) => (
              <Card key={mensaje.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {mensaje.subject}
                        </h3>
                        <Badge className={getEstadoColor(mensaje.delivery.state)}>
                          {getEstadoTexto(mensaje.delivery.state)}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                        <div className="flex items-center">
                          <Clock className="mr-1 h-3 w-3" />
                          {format(mensaje.createdAt, 'dd/MM/yyyy HH:mm', { locale: es })}
                        </div>
                        {mensaje.tracking.opened && (
                          <div className="flex items-center text-green-600">
                            <Eye className="mr-1 h-3 w-3" />
                            {mensaje.tracking.openCount}x visto
                          </div>
                        )}
                        {mensaje.tracking.readConfirmed && (
                          <div className="flex items-center text-blue-600">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Leído confirmado
                          </div>
                        )}
                      </div>

                      {/* Preview del contenido */}
                      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: mensaje.message.html.replace(/<[^>]*>/g, '').substring(0, 200) + '...' 
                          }} 
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <Link href={`/dashboard/mensaje/${mensaje.id}`}>
                        <Button variant="outline" size="sm">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Ver
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Estadísticas del contacto */}
        {mensajes.length > 0 && (
          <div className="border-t pt-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">{mensajes.length}</div>
                <div className="text-sm text-gray-500">Total Mensajes</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {mensajes.filter(m => m.tracking.opened).length}
                </div>
                <div className="text-sm text-gray-500">Vistos</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {mensajes.filter(m => m.tracking.readConfirmed).length}
                </div>
                <div className="text-sm text-gray-500">Leídos</div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
