/** Máximo de envíos nuevos por día calendario (America/Argentina). */
export const DEFAULT_TANDA_SIZE = 100;

/** Atajos alineados al cupo Unique Users de Meta (1k / 10k / 100k) más un lote chico de calentamiento. */
export const TANDA_PRESETS = [100, 1_000, 2_000, 10_000, 100_000] as const;

/** Si el fanout quedó colgado, se puede volver a disparar después de esto. */
export const FANOUT_LOCK_TTL_MS = 6 * 60 * 60 * 1000;

export const FANOUT_BUSY_MSG =
  'Ya hay un envío en curso. Esperá a que termine esta tanda antes de volver a disparar.';

export const CAMPAIGN_DAY_TZ = 'America/Argentina/Buenos_Aires';

/** Hora local (Argentina) a la que arranca solo el lote del día siguiente. */
export const DAILY_SEND_HOUR = 9;

function lockTimestampMs(at: unknown): number {
  if (!at) return 0;
  if (typeof at === 'number' && Number.isFinite(at)) return at;
  if (at instanceof Date) return at.getTime();
  if (typeof at === 'object' && at !== null && 'toMillis' in at && typeof (at as { toMillis: () => number }).toMillis === 'function') {
    return (at as { toMillis: () => number }).toMillis();
  }
  return 0;
}

/** True si otro send/fanout de esta campaña sigue en vuelo (o el lock no expiró). */
export function campaignFanoutIsBusy(
  data: { fanoutActive?: unknown; fanoutLockAt?: unknown },
  now = Date.now()
): boolean {
  if (data.fanoutActive !== true) return false;
  const ms = lockTimestampMs(data.fanoutLockAt);
  if (!ms) return true;
  return now - ms < FANOUT_LOCK_TTL_MS;
}

export function campaignDayKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMPAIGN_DAY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addCampaignDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 15, 0, 0));
  return campaignDayKey(dt);
}

/** Segundos hasta `hour`:00 de ese día en Argentina. Mínimo 30s. */
export function secondsUntilCampaignHour(dayKey: string, hour = DAILY_SEND_HOUR, now = new Date()): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  const utcHour = hour + 3;
  const targetMs = Date.UTC(y, m - 1, d, utcHour, 0, 0);
  return Math.max(30, Math.ceil((targetMs - now.getTime()) / 1000));
}

export function nextCampaignMorning(now = new Date()): { dayKey: string; delaySeconds: number; at: Date } {
  const dayKey = addCampaignDays(campaignDayKey(now), 1);
  const delaySeconds = secondsUntilCampaignHour(dayKey, DAILY_SEND_HOUR, now);
  const at = new Date(Date.now() + delaySeconds * 1000);
  return { dayKey, delaySeconds, at };
}

export type DailyQuotaCampaign = {
  tandaSize?: unknown;
  tandaDayKey?: unknown;
  tandaDayQuota?: unknown;
  tandaDaySentStart?: unknown;
};

export function upcomingDailyQuota(data: DailyQuotaCampaign): number {
  return typeof data.tandaSize === 'number' && data.tandaSize > 0 ? data.tandaSize : 0;
}

export type DailySendPlan = {
  todayKey: string;
  dailyQuota: number;
  upcomingQuota: number;
  sentToday: number;
  remainingToday: number;
  remainingTotal: number;
  thisRun: number;
  tandaCap: number;
  sameDay: boolean;
  dayFields: {
    tandaDayKey: string;
    tandaDayQuota: number;
    tandaDaySentStart: number;
  };
};

/**
 * Cupo del día: si ya se disparó hoy, queda congelado.
 * `tandaSize` es el cupo de los días siguientes (se puede editar ahora; rige mañana).
 * 0 = sin tope (simulación / envío completo).
 */
export function planDailySend(params: {
  campaign: DailyQuotaCampaign;
  alreadySent: number;
  totalRecipients: number;
  retryErrors?: boolean;
  /** Si true, hoy se encola lo que falte aunque pase el cupo diario. */
  exceedDailyQuota?: boolean;
  now?: Date;
}): DailySendPlan {
  const now = params.now ?? new Date();
  const todayKey = campaignDayKey(now);
  const remainingTotal = Math.max(0, params.totalRecipients - params.alreadySent);
  const upcomingQuota = upcomingDailyQuota(params.campaign);
  const sameDay =
    typeof params.campaign.tandaDayKey === 'string' && params.campaign.tandaDayKey === todayKey;
  const lockedQuota =
    sameDay && typeof params.campaign.tandaDayQuota === 'number' && params.campaign.tandaDayQuota > 0
      ? params.campaign.tandaDayQuota
      : upcomingQuota;
  const sentStart =
    sameDay && typeof params.campaign.tandaDaySentStart === 'number'
      ? params.campaign.tandaDaySentStart
      : params.alreadySent;
  const sentToday = Math.max(0, params.alreadySent - sentStart);
  const remainingToday = lockedQuota > 0 ? Math.max(0, lockedQuota - sentToday) : remainingTotal;
  const ignoreCap = params.retryErrors === true || params.exceedDailyQuota === true;
  const thisRun = ignoreCap
    ? remainingTotal
    : lockedQuota > 0
      ? Math.min(remainingToday, remainingTotal)
      : remainingTotal;

  return {
    todayKey,
    dailyQuota: lockedQuota,
    upcomingQuota,
    sentToday,
    remainingToday,
    remainingTotal,
    thisRun,
    tandaCap: params.alreadySent + thisRun,
    sameDay,
    dayFields: {
      tandaDayKey: todayKey,
      tandaDayQuota: lockedQuota,
      tandaDaySentStart: sentStart,
    },
  };
}
