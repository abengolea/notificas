import type { Campaign, CanalCampaign } from "@/lib/types";

const TZ = "America/Argentina/Buenos_Aires";
const MONTH_COUNT = 12;

export type OrgDashboardMonth = {
  key: string;
  label: string;
  enviados: number;
  email: number;
  whatsapp: number;
  campanas: number;
};

export type OrgDashboardStats = {
  campanas: number;
  porEstado: Record<Campaign["estado"], number>;
  destinatarios: number;
  enviados: number;
  leidos: number;
  pendientes: number;
  errores: number;
  tasaLectura: number;
  enviadosMes: number;
  enviadosMesAnterior: number;
  deltaEnviadosMesPct: number | null;
  emailEnviados: number;
  waEnviados: number;
  mixtas: number;
  pendientesWa: number;
  months: OrgDashboardMonth[];
  enCurso: Campaign[];
  recientes: Campaign[];
  omitidasSimuladas: number;
};

export function isRealCampaign(c: { simulated?: unknown } | null | undefined): boolean {
  return c?.simulated !== true;
}

export function parseCampaignInstant(ts: unknown): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? null : ts;
  if (typeof ts === "string") {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts === "object") {
    const o = ts as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof o.toDate === "function") {
      const d = o.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }
    const secs = o.seconds ?? o._seconds;
    if (typeof secs === "number") return new Date(secs * 1000);
  }
  return null;
}

export function campaignActivityAt(c: Campaign): Date | null {
  return parseCampaignInstant(c.startedAt) ?? parseCampaignInstant(c.createdAt);
}

export function canalOf(c: Campaign): CanalCampaign {
  return c.canal === "whatsapp" || c.canal === "ambos" ? c.canal : "email";
}

function monthKeyInTz(d: Date, timeZone = TZ): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat("es-AR", { month: "short", year: "2-digit", timeZone: "UTC" })
    .format(d)
    .replace(".", "");
}

function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

function emptyEstado(): Record<Campaign["estado"], number> {
  return { borrador: 0, enviando: 0, pausada: 0, completada: 0, cancelada: 0 };
}

export function buildOrgDashboardStats(
  campaigns: Campaign[],
  now: Date = new Date(),
): OrgDashboardStats {
  const omitidasSimuladas = campaigns.filter((c) => !isRealCampaign(c)).length;
  campaigns = campaigns.filter(isRealCampaign);

  const porEstado = emptyEstado();
  let destinatarios = 0;
  let enviados = 0;
  let leidos = 0;
  let pendientes = 0;
  let errores = 0;
  let emailEnviados = 0;
  let waEnviados = 0;
  let mixtas = 0;
  let pendientesWa = 0;

  const thisKey = monthKeyInTz(now);
  const prevKey = shiftMonthKey(thisKey, -1);
  const monthKeys: string[] = [];
  for (let i = MONTH_COUNT - 1; i >= 0; i--) {
    monthKeys.push(shiftMonthKey(thisKey, -i));
  }
  const monthMap = new Map<string, OrgDashboardMonth>(
    monthKeys.map((key) => [
      key,
      { key, label: monthLabel(key), enviados: 0, email: 0, whatsapp: 0, campanas: 0 },
    ]),
  );

  const dated = campaigns.map((c) => ({
    c,
    at: campaignActivityAt(c),
    key: (() => {
      const at = campaignActivityAt(c);
      return at ? monthKeyInTz(at) : null;
    })(),
  }));

  for (const { c, key } of dated) {
    const estado = (c.estado in porEstado ? c.estado : "borrador") as Campaign["estado"];
    porEstado[estado] += 1;
    destinatarios += c.recipientCount || 0;
    const st = c.stats || { total: 0, enviados: 0, leidos: 0, pendientes: 0, errores: 0 };
    enviados += st.enviados || 0;
    leidos += st.leidos || 0;
    pendientes += st.pendientes || 0;
    errores += st.errores || 0;

    const canal = canalOf(c);
    if (canal === "whatsapp") {
      waEnviados += st.enviados || 0;
      pendientesWa += st.pendientes || 0;
    } else if (canal === "ambos") {
      mixtas += 1;
      waEnviados += st.enviados || 0;
      emailEnviados += st.enviados || 0;
      pendientesWa += st.pendientes || 0;
    } else {
      emailEnviados += st.enviados || 0;
    }

    if (key && monthMap.has(key)) {
      const row = monthMap.get(key)!;
      row.campanas += 1;
      row.enviados += st.enviados || 0;
      if (canal === "whatsapp") row.whatsapp += st.enviados || 0;
      else if (canal === "ambos") {
        row.whatsapp += st.enviados || 0;
        row.email += st.enviados || 0;
      } else {
        row.email += st.enviados || 0;
      }
    }
  }

  const enviadosMes = monthMap.get(thisKey)?.enviados ?? 0;
  const enviadosMesAnterior = monthMap.get(prevKey)?.enviados ?? 0;
  const deltaEnviadosMesPct =
    enviadosMesAnterior === 0
      ? enviadosMes > 0
        ? null
        : 0
      : Math.round(((enviadosMes - enviadosMesAnterior) / enviadosMesAnterior) * 1000) / 10;

  const tasaLectura = enviados > 0 ? Math.round((leidos / enviados) * 1000) / 10 : 0;

  const enCurso = campaigns
    .filter((c) => c.estado === "enviando" || c.estado === "pausada" || (c.stats?.pendientes || 0) > 0)
    .sort((a, b) => (b.stats?.pendientes || 0) - (a.stats?.pendientes || 0));

  const recientes = [...dated]
    .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
    .slice(0, 12)
    .map((x) => x.c);

  return {
    campanas: campaigns.length,
    porEstado,
    destinatarios,
    enviados,
    leidos,
    pendientes,
    errores,
    tasaLectura,
    enviadosMes,
    enviadosMesAnterior,
    deltaEnviadosMesPct: enviadosMesAnterior === 0 && enviadosMes === 0 ? 0 : deltaEnviadosMesPct,
    emailEnviados,
    waEnviados,
    mixtas,
    pendientesWa,
    months: monthKeys.map((k) => monthMap.get(k)!),
    enCurso,
    recientes,
    omitidasSimuladas,
  };
}

export function formatInt(n: number): string {
  return n.toLocaleString("es-AR");
}

export function campaignTitle(c: Campaign): string {
  const nombre = (c.nombre || "").trim();
  if (nombre && nombre !== "undefined") return nombre;
  const asunto = (c.asunto || "").trim();
  if (asunto && asunto !== "undefined") return asunto;
  return "Campaña sin nombre";
}

export function campaignSubtitle(c: Campaign): string | null {
  const asunto = (c.asunto || "").trim();
  if (!asunto || asunto === "undefined" || asunto === campaignTitle(c)) return null;
  return asunto;
}

export function canalLabel(canal: CanalCampaign): string {
  if (canal === "whatsapp") return "WhatsApp";
  if (canal === "ambos") return "Email + WhatsApp";
  return "Email";
}
