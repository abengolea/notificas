
"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"

const data = [
  { name: "Ene", "Nuevos Usuarios": 400, "Ingresos": 2400 },
  { name: "Feb", "Nuevos Usuarios": 300, "Ingresos": 1398 },
  { name: "Mar", "Nuevos Usuarios": 200, "Ingresos": 9800 },
  { name: "Abr", "Nuevos Usuarios": 278, "Ingresos": 3908 },
  { name: "May", "Nuevos Usuarios": 189, "Ingresos": 4800 },
  { name: "Jun", "Nuevos Usuarios": 239, "Ingresos": 3800 },
  { name: "Jul", "Nuevos Usuarios": 349, "Ingresos": 4300 },
  { name: "Ago", "Nuevos Usuarios": 380, "Ingresos": 5100 },
  { name: "Sep", "Nuevos Usuarios": 410, "Ingresos": 6200 },
  { name: "Oct", "Nuevos Usuarios": 390, "Ingresos": 5800 },
  { name: "Nov", "Nuevos Usuarios": 450, "Ingresos": 7100 },
  { name: "Dic", "Nuevos Usuarios": 480, "Ingresos": 7500 },
]

export default function OverviewChart() {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip
            cursor={{fill: 'hsl(var(--muted))'}}
            contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                borderColor: 'hsl(var(--border))',
                borderRadius: 'var(--radius)',
            }}
        />
        <Legend
            wrapperStyle={{
                paddingTop: '20px'
            }}
        />
        <Bar dataKey="Nuevos Usuarios" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Nuevos Usuarios" />
        <Bar dataKey="Ingresos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Ingresos (ARS)" />
      </BarChart>
    </ResponsiveContainer>
  )
}
