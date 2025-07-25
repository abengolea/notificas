"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "@/hooks/use-toast"
import { DollarSign, Edit, MoreVertical, PlusCircle, Trash, Package, TrendingUp, Gift } from "lucide-react"
import type { Plan } from "@/lib/types"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
  } from "@/components/ui/form"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "../ui/textarea"

const planSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  descripcion: z.string().min(10, "La descripción debe tener al menos 10 caracteres."),
  precio: z.coerce.number().min(0, "El precio debe ser positivo."),
  type: z.enum(["unitario", "pack", "suscripcion"]),
})

type PlanFormValues = z.infer<typeof planSchema>

interface PlanManagementProps {
  planes: Plan[]
}

const planIcons = {
    unitario: <Gift className="h-4 w-4 text-muted-foreground" />,
    pack: <Package className="h-4 w-4 text-muted-foreground" />,
    suscripcion: <TrendingUp className="h-4 w-4 text-muted-foreground" />,
}

export default function PlanManagement({ planes: initialPlanes }: PlanManagementProps) {
  const [planes, setPlanes] = React.useState<Plan[]>(initialPlanes)
  const [isDialogOpen, setDialogOpen] = React.useState(false)
  const [editingPlan, setEditingPlan] = React.useState<Plan | null>(null)

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      nombre: "",
      descripcion: "",
      precio: 0,
      type: "pack",
    },
  })

  React.useEffect(() => {
    if (editingPlan) {
      form.reset(editingPlan)
    } else {
      form.reset({
        nombre: "",
        descripcion: "",
        precio: 0,
        type: "pack",
      })
    }
  }, [editingPlan, form])

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan)
    setDialogOpen(true)
  }

  const handleAddNew = () => {
    setEditingPlan(null)
    setDialogOpen(true)
  }

  const handleDelete = (planId: string) => {
    setPlanes(planes.filter(p => p.id !== planId))
    toast({ title: "Plan eliminado", description: "El plan ha sido eliminado correctamente." })
  }

  function onSubmit(data: PlanFormValues) {
    if (editingPlan) {
      // Update existing plan
      setPlanes(planes.map(p => p.id === editingPlan.id ? { ...p, ...data } : p))
      toast({ title: "Plan actualizado", description: "El plan ha sido guardado correctamente." })
    } else {
      // Add new plan
      const newPlan = { ...data, id: `plan-${Date.now()}` }
      setPlanes([...planes, newPlan])
      toast({ title: "Plan creado", description: "El nuevo plan ha sido añadido." })
    }
    setDialogOpen(false)
    setEditingPlan(null)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>Planes y Precios</CardTitle>
                <CardDescription>
                Crea, edita y elimina los planes de la plataforma.
                </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                    <Button onClick={handleAddNew}>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Añadir Plan
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingPlan ? 'Editar Plan' : 'Crear Nuevo Plan'}</DialogTitle>
                        <DialogDescription>
                            Rellena los detalles del plan. Los cambios se reflejarán inmediatamente.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="nombre"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre del Plan</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ej: Pack 25 Envíos" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="descripcion"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Descripción</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Describe brevemente el plan" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="precio"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Precio (ARS)</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input type="number" step="0.01" placeholder="999.99" className="pl-9" {...field} />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Plan</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                        <SelectValue placeholder="Selecciona un tipo" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="unitario">Unitario</SelectItem>
                                        <SelectItem value="pack">Pack</SelectItem>
                                        <SelectItem value="suscripcion">Suscripción</SelectItem>
                                    </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Unitario (1 envío), Pack (múltiples envíos), Suscripción (recurrente).
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                                <Button type="submit">Guardar Plan</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
      </CardHeader>
      <CardContent>
      <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead>
                        <span className="sr-only">Acciones</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {planes.map((plan) => (
                    <TableRow key={plan.id}>
                        <TableCell className="font-medium">{plan.nombre}</TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                {planIcons[plan.type]}
                                <span className="capitalize">{plan.type}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right">${plan.precio.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => handleEdit(plan)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(plan.id)} className="text-destructive">
                                    <Trash className="mr-2 h-4 w-4" />
                                    Eliminar
                                </DropdownMenuItem>
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
