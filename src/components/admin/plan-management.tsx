
"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "@/hooks/use-toast"
import { DollarSign, Edit, MoreVertical, PlusCircle, Trash, Package, TrendingUp, Gift, Loader2, Percent } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"

const planSchema = z.object({
  slug: z
    .string()
    .max(64)
    .regex(/^$|^[a-z0-9][a-z0-9_-]{0,63}$/i, "Solo letras, números, guiones; sin espacios.")
    .optional(),
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  descripcion: z.string().min(10, "La descripción debe tener al menos 10 caracteres."),
  precio: z.coerce.number().min(0, "El precio debe ser positivo."),
  creditos: z.coerce.number().int().min(1, "Mínimo 1 envío (Mercado Pago lo requiere)."),
  orden: z.coerce.number().int().optional(),
  activo: z.boolean(),
  type: z.enum(["unitario", "pack", "suscripcion"]),
})

type PlanFormValues = z.infer<typeof planSchema>

const planIcons = {
    unitario: <Gift className="h-4 w-4 text-muted-foreground" />,
    pack: <Package className="h-4 w-4 text-muted-foreground" />,
    suscripcion: <TrendingUp className="h-4 w-4 text-muted-foreground" />,
}

export default function PlanManagement() {
  const [planes, setPlanes] = React.useState<Plan[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [bulkPctOpen, setBulkPctOpen] = React.useState(false)
  const [bulkPercentStr, setBulkPercentStr] = React.useState("")
  const [bulkApplying, setBulkApplying] = React.useState(false)
  const [isDialogOpen, setDialogOpen] = React.useState(false)
  const [editingPlan, setEditingPlan] = React.useState<Plan | null>(null)

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      slug: "",
      nombre: "",
      descripcion: "",
      precio: 0,
      creditos: 1,
      orden: undefined,
      activo: true,
      type: "pack",
    },
  })

  const loadPlans = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/plans", { credentials: "include" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : `HTTP ${res.status}`)
      }
      const raw = Array.isArray(data?.plans) ? data.plans : []
      setPlanes(raw as Plan[])
    } catch (e) {
      console.error(e)
      toast({
        title: "No se pudieron cargar los planes",
        description: e instanceof Error ? e.message : "Reintentá o verificá la sesión del admin.",
        variant: "destructive",
      })
      setPlanes([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadPlans()
  }, [loadPlans])

  React.useEffect(() => {
    if (editingPlan) {
      form.reset({
        slug: "",
        nombre: editingPlan.nombre,
        descripcion: editingPlan.descripcion,
        precio: editingPlan.precio,
        creditos: editingPlan.creditos ?? 1,
        orden: editingPlan.orden,
        activo: editingPlan.activo !== false,
        type: editingPlan.type,
      })
    } else {
      form.reset({
        slug: "",
        nombre: "",
        descripcion: "",
        precio: 0,
        creditos: 1,
        orden: (planes[planes.length - 1]?.orden ?? 0) + 1,
        activo: true,
        type: "pack",
      })
    }
  }, [editingPlan, form, isDialogOpen, planes])

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan)
    setDialogOpen(true)
  }

  const handleAddNew = () => {
    setEditingPlan(null)
    setDialogOpen(true)
  }

  const handleDelete = async (planId: string) => {
    try {
      const res = await fetch(`/api/admin/plans?id=${encodeURIComponent(planId)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : `HTTP ${res.status}`)
      }
      toast({ title: "Plan desactivado", description: "Ya no se muestra en la billetera; el documento se conserva por las referencias de pago." })
      await loadPlans()
    } catch (e) {
      toast({
        title: "Error al desactivar",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    }
  }

  async function onSubmit(data: PlanFormValues) {
    setSaving(true)
    try {
      if (editingPlan) {
        const res = await fetch("/api/admin/plans", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingPlan.id,
            nombre: data.nombre,
            descripcion: data.descripcion,
            precio: data.precio,
            creditos: data.creditos,
            type: data.type,
            activo: data.activo,
            orden: data.orden,
          }),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(typeof j?.error === "string" ? j.error : `HTTP ${res.status}`)
        toast({ title: "Plan actualizado", description: "Los cambios ya están en Firestore." })
      } else {
        const id = data.slug?.trim() || undefined
        const body: Record<string, unknown> = {
          ...(id ? { id } : {}),
          nombre: data.nombre,
          descripcion: data.descripcion,
          precio: data.precio,
          creditos: data.creditos,
          type: data.type,
          activo: data.activo,
          orden: data.orden,
        }
        const res = await fetch("/api/admin/plans", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(typeof j?.error === "string" ? j.error : `HTTP ${res.status}`)
        toast({ title: "Plan creado", description: `ID: ${typeof j?.plan?.id === "string" ? j.plan.id : "nuevo"}` })
      }
      setDialogOpen(false)
      setEditingPlan(null)
      await loadPlans()
    } catch (e) {
      toast({
        title: editingPlan ? "No se pudo actualizar" : "No se pudo crear",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  async function aplicarAumentoGlobalPct() {
    const pctNum = Number(String(bulkPercentStr).trim().replace(",", "."))
    if (!Number.isFinite(pctNum) || pctNum < -90 || pctNum > 1000) {
      toast({
        title: "Porcentaje inválido",
        description: "Ingresá un número entre -90 y 1000 (usa punto o coma decimal).",
        variant: "destructive",
      })
      return
    }

    setBulkApplying(true)
    try {
      const res = await fetch("/api/admin/plans/apply-percent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ percent: pctNum }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof j?.error === "string" ? j.error : `HTTP ${res.status}`)
      }

      const n = typeof j?.count === "number" ? j.count : 0
      toast({
        title: "Precios actualizados",
        description:
          n > 0
            ? `Se ajustaron ${n} plan${n === 1 ? "" : "es"} (${pctNum > 0 ? "+" : ""}${pctNum}% sobre el precio actual). Cambios ya en Firestore.`
            : typeof j?.message === "string"
              ? j.message
              : "No hubo actualizaciones.",
      })
      setBulkPctOpen(false)
      await loadPlans()
    } catch (e) {
      toast({
        title: "No se pudo aplicar el ajuste",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setBulkApplying(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
                <CardTitle>Planes y precios</CardTitle>
                <CardDescription>
                Misma fuente que la billetera: Firestore <code className="text-xs rounded bg-muted px-1 py-0.5">plans</code>. Lectura en la app sólo muestra planes con <strong>activo</strong> y ordenados por número de orden.
                </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void loadPlans()} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Recargar
              </Button>
              <AlertDialog
                open={bulkPctOpen}
                onOpenChange={(o) => {
                  setBulkPctOpen(o)
                  if (!o) setBulkPercentStr("")
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={loading || planes.length === 0 || bulkApplying}
                  >
                    <Percent className="mr-2 h-4 w-4" />
                    Aumento % a todos
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Ajuste masivo por porcentaje</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        <p>
                          Se multiplica cada <strong className="text-foreground">precio actual</strong> por{' '}
                          <code className="rounded bg-muted px-1 py-px">1 + (p / 100)</code> y se redondea a dos
                          decimales. Impacta <strong className="text-foreground">todos los planes</strong> en
                          Firestore de inmediato.
                        </p>
                        <div className="space-y-2 text-left">
                          <Label htmlFor="bulk-pct-input">Porcentaje p</Label>
                          <Input
                            id="bulk-pct-input"
                            type="number"
                            step="any"
                            placeholder="Ej: 10 aumenta ~10%"
                            value={bulkPercentStr}
                            onChange={(e) => setBulkPercentStr(e.target.value)}
                            disabled={bulkApplying}
                            className="font-mono"
                          />
                          <p className="text-xs">
                            Ej.: <strong>15</strong> sube cada precio un 15%. Valores negativos reducen precio (
                            mín. -90%).
                          </p>
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={bulkApplying}>Cancelar</AlertDialogCancel>
                    <Button type="button" disabled={bulkApplying} onClick={() => void aplicarAumentoGlobalPct()}>
                      {bulkApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Aplicar ahora
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                    <Button onClick={handleAddNew}>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Añadir plan
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingPlan ? "Editar plan" : "Nuevo plan"}</DialogTitle>
                        <DialogDescription>
                          {editingPlan
                            ? "Los cambios se guardan en Firestore y afectan a Mercado Pago en la próxima compra."
                            : "Podés fijar un ID (slug) para coincidir con enlaces o dejarlo vacío y se genera uno automático."}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            {!editingPlan ? (
                            <FormField
                                control={form.control}
                                name="slug"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>ID del documento (opcional)</FormLabel>
                                    <FormControl>
                                      <Input placeholder="ej: pack100" {...field} />
                                    </FormControl>
                                    <FormDescription>Sin espacios; si lo dejás vacío se usa un ID automático.</FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            ) : null}
                            <FormField
                                control={form.control}
                                name="nombre"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre</FormLabel>
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
                                            <Textarea placeholder="Lo que ven los usuarios al comprar" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="creditos"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Envíos otorgados al pagar</FormLabel>
                                        <FormControl>
                                            <Input type="number" min={1} step={1} {...field} />
                                        </FormControl>
                                        <FormDescription>
                                          Obligatorio para la preferencia de Mercado Pago.
                                        </FormDescription>
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
                              name="orden"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Orden de visualización</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step={1}
                                      placeholder="1, 2, 3…"
                                      {...field}
                                      value={field.value ?? ""}
                                      onChange={(e) => {
                                        const v = e.target.value
                                        field.onChange(v === "" ? undefined : Number(v))
                                      }}
                                    />
                                  </FormControl>
                                  <FormDescription>Menor número aparece primero en la billetera.</FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                                control={form.control}
                                name="activo"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center gap-2 space-y-0 rounded-md border p-3">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={(v) => field.onChange(v === true)}
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                      <FormLabel>Visible en la billetera</FormLabel>
                                      <FormDescription>Si se desmarca, los usuarios no lo ven (equivalente a desactivar).</FormDescription>
                                    </div>
                                  </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
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
                                        Etiqueta interna; el cobro siempre suma <strong>envíos</strong> según el número de arriba.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                                <Button type="submit" disabled={saving}>
                                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  Guardar
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            </div>
        </div>
      </CardHeader>
      <CardContent>
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando planes desde Firestore…
        </div>
      ) : (
      <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Envíos</TableHead>
                    <TableHead className="text-right">Orden</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead>
                        <span className="sr-only">Acciones</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {planes.map((plan) => (
                    <TableRow key={plan.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{plan.id}</TableCell>
                        <TableCell className="font-medium">{plan.nombre}</TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                {planIcons[plan.type]}
                                <span className="capitalize">{plan.type}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right">{plan.creditos ?? "—"}</TableCell>
                        <TableCell className="text-right">{plan.orden ?? "—"}</TableCell>
                        <TableCell>
                          {plan.activo !== false ? (
                            <Badge variant="secondary">Activo</Badge>
                          ) : (
                            <Badge variant="outline">Inactivo</Badge>
                          )}
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
                                <DropdownMenuItem
                                  onClick={() => void handleDelete(plan.id)}
                                  className="text-destructive"
                                  disabled={plan.activo === false}
                                >
                                    <Trash className="mr-2 h-4 w-4" />
                                    Desactivar
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
      )}
      {!loading && planes.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No hay documentos en <code className="rounded bg-muted px-1">plans</code>. Ejecutá el script de inicialización o creá el primero con &quot;Añadir plan&quot;.
        </p>
      ) : null}
      </CardContent>
    </Card>
  )
}
