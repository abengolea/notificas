export type CampaignLimitSource = 'whatsapp' | 'polygon' | 'gcp';

export type CampaignLimitHit = {
  source: CampaignLimitSource;
  code: string;
  reason: string;
};

const WA_ACCOUNT_LIMIT_CODES = new Set([
  '4',
  '102',
  '190',
  '613',
  '80007',
  '130429',
  '131031',
  '131048',
  '131056',
  '132015',
  '132016',
  '133016',
]);

const WA_LIMIT_TEXT =
  /rate[\s_-]?limit|too many requests|throughput|spam rate|account.{0,40}(locked|restricted|banned)|limit reached|temporarily (blocked|unavailable)|experiment group|pairing rate|unique user/i;

const POLYGON_LIMIT_TEXT =
  /insufficient.?funds|sin balance pol|fondos insuficientes|replacement fee too low|nonce too low|(-32005)|rpc.*limit|polygon.*quota/i;

const GCP_LIMIT_TEXT =
  /resource_exhausted|quota.?exceeded|too many outstanding requests|cloud tasks api error 429|429 too many|rateLimitExceeded|billing|exceeded.{0,40}quota/i;

function asCode(value: unknown): string {
  if (value == null || value === '') return '';
  return String(value).replace(/^#+/, '').trim();
}

function blob(parts: unknown[]): string {
  return parts
    .filter((p) => p != null && p !== '')
    .map((p) => String(p))
    .join(' ');
}

export function classifyCampaignLimit(input: {
  httpStatus?: number;
  errorCode?: unknown;
  message?: unknown;
  limitHit?: unknown;
  limitSource?: unknown;
}): CampaignLimitHit | null {
  const message = blob([input.message]);
  const code = asCode(input.errorCode) || (message.match(/#(\d{2,6})/)?.[1] ?? '');
  const http = typeof input.httpStatus === 'number' ? input.httpStatus : 0;
  const hinted = input.limitSource === 'whatsapp' || input.limitSource === 'polygon' || input.limitSource === 'gcp'
    ? input.limitSource
    : null;

  if (input.limitHit === true && hinted) {
    return {
      source: hinted,
      code: code || String(http || 'limit'),
      reason: message || `Límite de ${hinted}`,
    };
  }

  if (POLYGON_LIMIT_TEXT.test(message)) {
    return {
      source: 'polygon',
      code: code || 'polygon_limit',
      reason: message || 'Límite de Polygon (gas, RPC o cupo)',
    };
  }

  if (WA_ACCOUNT_LIMIT_CODES.has(code) || WA_LIMIT_TEXT.test(message)) {
    return {
      source: 'whatsapp',
      code: code || (http === 429 ? '429' : 'wa_limit'),
      reason: message || 'Límite de WhatsApp / Meta',
    };
  }

  if (
    GCP_LIMIT_TEXT.test(message) ||
    /Cloud Tasks API error/i.test(message) ||
    http === 429
  ) {
    return {
      source: 'gcp',
      code: code || (http === 429 ? '429' : 'gcp_limit'),
      reason: message || 'Cuota de Google Cloud',
    };
  }

  return null;
}

export function classifyCampaignLimitFromUnknown(err: unknown, extra?: {
  httpStatus?: number;
  errorCode?: unknown;
  limitHit?: unknown;
  limitSource?: unknown;
}): CampaignLimitHit | null {
  const message =
    err instanceof Error
      ? err.message
      : typeof extra?.errorCode === 'string'
        ? extra.errorCode
        : typeof err === 'string'
          ? err
          : JSON.stringify(err);
  return classifyCampaignLimit({ ...extra, message });
}

export function campaignLimitUserMessage(hit: CampaignLimitHit): string {
  const bySource: Record<CampaignLimitSource, string> = {
    whatsapp: 'WhatsApp/Meta alcanzó un límite (rate-limit, plantilla o cuenta).',
    polygon: 'Polygon alcanzó un límite (POL, RPC o cuota).',
    gcp: 'Google Cloud alcanzó un límite (Cloud Tasks, Functions o cuota).',
  };
  const head = bySource[hit.source];
  const detail = hit.reason.replace(/\s+/g, ' ').slice(0, 280);
  return `${head} Campaña pausada para no seguir generando errores. ${detail}`.trim();
}
