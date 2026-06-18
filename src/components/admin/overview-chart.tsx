"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { AdminChartMonth } from "@/lib/admin-stats-server";

type OverviewChartProps = {
  data: AdminChartMonth[];
};

export default function OverviewChart({ data }: OverviewChartProps) {
  const chartData = data.map((row) => ({
    name: row.name,
    "Nuevos Usuarios": row.nuevosUsuarios,
    Ingresos: row.ingresos,
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={chartData}>
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
          cursor={{ fill: "hsl(var(--muted))" }}
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            borderColor: "hsl(var(--border))",
            borderRadius: "var(--radius)",
          }}
        />
        <Legend
          wrapperStyle={{
            paddingTop: "20px",
          }}
        />
        <Bar
          dataKey="Nuevos Usuarios"
          fill="hsl(var(--accent))"
          radius={[4, 4, 0, 0]}
          name="Nuevos Usuarios"
        />
        <Bar
          dataKey="Ingresos"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
          name="Ingresos (ARS)"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
