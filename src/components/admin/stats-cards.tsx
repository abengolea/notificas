import { DollarSign, Users, Mail, BarChart } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminStats } from "@/lib/types";

type StatsDeltas = {
  ingresosEstimados: number | null;
  mensajesMes: number | null;
  tasaActividad: number | null;
};

interface StatsCardsProps {
  stats: AdminStats;
  nuevosUsuariosMes: number;
  tasaActividad: number;
  deltas: StatsDeltas;
}

function formatDelta(value: number | null, suffix = "%"): string {
  if (value === null) return "Sin datos del mes anterior";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}${suffix} que el mes pasado`;
}

export default function StatsCards({
  stats,
  nuevosUsuariosMes,
  tasaActividad,
  deltas,
}: StatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Ingresos Estimados (Mensual)
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${stats.ingresosEstimados.toLocaleString("es-AR")}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDelta(deltas.ingresosEstimados)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.usuariosActivos.toLocaleString("es-AR")}</div>
          <p className="text-xs text-muted-foreground">
            {nuevosUsuariosMes > 0
              ? `+${nuevosUsuariosMes.toLocaleString("es-AR")} nuevos este mes`
              : "Sin registros nuevos este mes"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mensajes Enviados (Mes)</CardTitle>
          <Mail className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.mensajesMes.toLocaleString("es-AR")}</div>
          <p className="text-xs text-muted-foreground">
            {formatDelta(deltas.mensajesMes)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tasa de Actividad</CardTitle>
          <BarChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{tasaActividad.toLocaleString("es-AR")}%</div>
          <p className="text-xs text-muted-foreground">
            {deltas.tasaActividad === null
              ? "Sin envíos registrados el mes pasado"
              : formatDelta(deltas.tasaActividad, " p.p.")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
