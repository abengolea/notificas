import { Timestamp, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type { AdminStats } from "@/lib/types";

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

export type AdminChartMonth = {
  name: string;
  nuevosUsuarios: number;
  ingresos: number;
};

export type AdminStatsPayload = {
  stats: AdminStats;
  nuevosUsuariosMes: number;
  tasaActividad: number;
  deltas: {
    ingresosEstimados: number | null;
    mensajesMes: number | null;
    tasaActividad: number | null;
  };
  chart: AdminChartMonth[];
};

function toDate(v: unknown): Date | null {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function inRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date < end;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function monthLabel(d: Date): string {
  return MONTH_LABELS[d.getMonth()] ?? "?";
}

export async function getAdminStats(): Promise<AdminStatsPayload> {
  const db = getAdminDb();
  const now = new Date();
  const thisMonth = monthStart(now);
  const lastMonth = addMonths(thisMonth, -1);
  const chartStart = addMonths(thisMonth, -11);
  const queryFrom = addMonths(thisMonth, -12);

  const chartBuckets = Array.from({ length: 12 }, (_, i) => {
    const start = addMonths(chartStart, i);
    return {
      name: monthLabel(start),
      start,
      end: addMonths(start, 1),
      nuevosUsuarios: 0,
      ingresos: 0,
    };
  });

  let usuariosActivos = 0;
  let nuevosUsuariosMes = 0;

  let usersSnap;
  try {
    usersSnap = await db.collection("users").orderBy("createdAt", "desc").limit(3000).get();
  } catch {
    usersSnap = await db.collection("users").limit(3000).get();
  }

  for (const docSnap of usersSnap.docs) {
    const d = docSnap.data() as Record<string, unknown>;
    if (d.estado !== "suspendido") usuariosActivos += 1;

    const created = toDate(d.createdAt);
    if (!created) continue;

    if (inRange(created, thisMonth, addMonths(thisMonth, 1))) {
      nuevosUsuariosMes += 1;
    }

    for (const bucket of chartBuckets) {
      if (inRange(created, bucket.start, bucket.end)) {
        bucket.nuevosUsuarios += 1;
        break;
      }
    }
  }

  let ingresosEstimados = 0;
  let ingresosMesAnterior = 0;
  let mensajesMes = 0;
  let mensajesMesAnterior = 0;
  const sendersThisMonth = new Set<string>();
  const sendersLastMonth = new Set<string>();

  let txSnap;
  try {
    txSnap = await db
      .collection("user_transactions")
      .where("fecha", ">=", Timestamp.fromDate(queryFrom))
      .get();
  } catch {
    txSnap = await db.collection("user_transactions").limit(5000).get();
  }

  for (const docSnap of txSnap.docs) {
    const d = docSnap.data() as Record<string, unknown>;
    const fecha = toDate(d.fecha);
    if (!fecha) continue;

    const tipo = String(d.tipo ?? "");
    const monto = typeof d.monto === "number" && Number.isFinite(d.monto) ? d.monto : 0;
    const userId = typeof d.userId === "string" ? d.userId : "";

    if (tipo === "compra" && monto > 0) {
      if (inRange(fecha, thisMonth, addMonths(thisMonth, 1))) {
        ingresosEstimados += monto;
      } else if (inRange(fecha, lastMonth, thisMonth)) {
        ingresosMesAnterior += monto;
      }

      for (const bucket of chartBuckets) {
        if (inRange(fecha, bucket.start, bucket.end)) {
          bucket.ingresos += monto;
          break;
        }
      }
    }

    if (tipo === "envio") {
      if (inRange(fecha, thisMonth, addMonths(thisMonth, 1))) {
        mensajesMes += 1;
        if (userId) sendersThisMonth.add(userId);
      } else if (inRange(fecha, lastMonth, thisMonth)) {
        mensajesMesAnterior += 1;
        if (userId) sendersLastMonth.add(userId);
      }
    }
  }

  let campaignDocs: QueryDocumentSnapshot[] = [];
  try {
    const campaignSnap = await db
      .collection("campaign_messages")
      .where("enviadoAt", ">=", Timestamp.fromDate(lastMonth))
      .get();
    campaignDocs = campaignSnap.docs;
  } catch {
    campaignDocs = [];
  }

  for (const docSnap of campaignDocs) {
    const d = docSnap.data() as Record<string, unknown>;
    const estado = String(d.estado ?? "");
    if (estado !== "enviado" && estado !== "leido") continue;

    const enviadoAt = toDate(d.enviadoAt);
    if (!enviadoAt) continue;

    const ownerId =
      (typeof d.ownerUserId === "string" && d.ownerUserId) ||
      (typeof d.createdBy === "string" && d.createdBy) ||
      "";

    if (inRange(enviadoAt, thisMonth, addMonths(thisMonth, 1))) {
      mensajesMes += 1;
      if (ownerId) sendersThisMonth.add(ownerId);
    } else if (inRange(enviadoAt, lastMonth, thisMonth)) {
      mensajesMesAnterior += 1;
      if (ownerId) sendersLastMonth.add(ownerId);
    }
  }

  const tasaActividad =
    usuariosActivos > 0 ? (sendersThisMonth.size / usuariosActivos) * 100 : 0;
  const tasaActividadAnterior =
    usuariosActivos > 0 ? (sendersLastMonth.size / usuariosActivos) * 100 : 0;

  const stats: AdminStats = {
    usuariosActivos,
    mensajesMes,
    ingresosEstimados: Math.round(ingresosEstimados * 100) / 100,
  };

  return {
    stats,
    nuevosUsuariosMes,
    tasaActividad: Math.round(tasaActividad * 10) / 10,
    deltas: {
      ingresosEstimados: pctChange(ingresosEstimados, ingresosMesAnterior),
      mensajesMes: pctChange(mensajesMes, mensajesMesAnterior),
      tasaActividad:
        sendersLastMonth.size > 0 || sendersThisMonth.size > 0
          ? Math.round((tasaActividad - tasaActividadAnterior) * 10) / 10
          : null,
    },
    chart: chartBuckets.map(({ name, nuevosUsuarios, ingresos }) => ({
      name,
      nuevosUsuarios,
      ingresos: Math.round(ingresos * 100) / 100,
    })),
  };
}
