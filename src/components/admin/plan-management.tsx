"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "@/hooks/use-toast"
import { DollarSign, Package, Save, TrendingUp } from "lucide-react"

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
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
  } from "@/components/ui/form"
  

const planSchema = z.object({
  individual: z.coerce.number().min(0, "El precio debe ser positivo"),
  pack10: z.coerce.number().min(0, "El precio debe ser positivo"),
  ilimitado: z.coerce.number().min(0, "El precio debe ser positivo"),
})

type PlanFormValues = z.infer<typeof planSchema>

interface PlanManagementProps {
  planes: Plan[]
}

export default function PlanManagement({ planes }: PlanManagementProps) {
    const form = useForm<PlanFormValues>({
        resolver: zodResolver(planSchema),
        defaultValues: {
          individual: planes.find(p => p.id === 'individual')?.precio || 0,
          pack10: planes.find(p => p.id === 'pack10')?.precio || 0,
          ilimitado: planes.find(p => p.id === 'ilimitado')?.precio || 0,
        },
      })
    
      function onSubmit(data: PlanFormValues) {
        toast({
          title: "Planes actualizados",
          description: "Los nuevos precios han sido guardados.",
          variant: "default",
        })
        console.log("Precios guardados:", data)
      }


  return (
    <Card>
      <CardHeader>
        <CardTitle>Planes y Precios</CardTitle>
        <CardDescription>
          Configura los precios de los diferentes planes y envíos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="individual"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center"><DollarSign className="h-4 w-4 mr-2" />Envío Individual</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" placeholder="500.00" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="pack10"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center"><Package className="h-4 w-4 mr-2" />Pack de 10 Envíos</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" placeholder="4500.00" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="ilimitado"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center"><TrendingUp className="h-4 w-4 mr-2" />Plan Mensual Ilimitado</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" placeholder="30000.00" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full">
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Precios
                </Button>
            </form>
        </Form>
      </CardContent>
    </Card>
  )
}
