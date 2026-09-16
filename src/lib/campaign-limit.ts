export type CampaignLimitSource = 'whatsapp' | 'polygon' | 'gcp' | 'resend' | 'credits';

export type CampaignLimitHit = {
  source: CampaignLimitSource;
  code: string;
  reason: string;
};

const LIMIT_SOURCES = new Set<CampaignLimitSource>([
  'whatsapp',
  'polygon',
  'gcp',
  'resend',
  'credits',
]);

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

const RESEND_LIMIT_TEXT =
  /resend|smtp\.resend|servidor de correo|no se recibi[oó] messageid|eauth|invalid.?api.?key|authentication.?failed|etimedout|econnreset|econnrefused|enotfound|socket hang up|greeting never received|unexpected socket close|sending.?(limit|quota)|daily.?email|monthly.?(quota|limit)|email.{0,20}quota|too many emails|payment.?required|domain.?not.?verif|454\b|421\b|451\b/i;

const CREDITS_LIMIT_TEXT = /sin env[ií]os disponibles|env[ií]os insuficientes/i;

/** Fallos de un destinatario: no frenan la campaña entera. */
const EMAIL_RECIPIENT_TEXT =
  /invalid.?recipient|mailbox.?(unavailable|not.?found)|user.?unknown|no such user|recipient.?rejected|address.?rejected|unknown.?user|all recipients were rejected|email inv[aá]lido|destinatario inv[aá]lido|550\s*5\.1\.1|551\s*5\.1|eenvelope/i;

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

function asLimitSource(value: unknown): CampaignLimitSource | null {
  return typeof value === 'string' && LIMIT_SOURCES.has(value as CampaignLimitSource)
    ? (value as CampaignLimitSource)
    : null;
}

export function isRecipientLevelEmailError(message: unknown): boolean {
  const text = blob([message]);
  if (!text) return false;
  if (RESEND_LIMIT_TEXT.test(text) || CREDITS_LIMIT_TEXT.test(text)) return false;
  return EMAIL_RECIPIENT_TEXT.test(text);
}

/** En email/mixto, un fallo de envío (salvo destinatario inválido) suspende la campaña. */
export function campaignEmailSendShouldPause(input: {
  canal?: unknown;
  error?: unknown;
  limitHit?: unknown;
}): boolean {
  if (input.limitHit === true) return true;
  const canal = String(input.canal || '');
  if (canal !== 'email' && canal !== 'ambos') return false;
  return !isRecipientLevelEmailError(input.error);
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
  const hinted = asLimitSource(input.limitSource);

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

  if (CREDITS_LIMIT_TEXT.test(message)) {
    return {
      source: 'credits',
      code: code || 'credits',
      reason: message || 'Sin envíos disponibles',
    };
  }

  if (RESEND_LIMIT_TEXT.test(message) && !isRecipientLevelEmailError(message)) {
    return {
      source: 'resend',
      code: code || (http === 429 ? '429' : 'resend'),
      reason: message || 'Error de Resend / correo',
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
    resend: 'Resend / el correo falló (cupo, autenticación o el proveedor no aceptó el envío).',
    credits: 'No quedan envíos disponibles en la cuenta.',
  };
  const head = bySource[hit.source];
  const detail = hit.reason.replace(/\s+/g, ' ').slice(0, 280);
  return `${head} Campaña pausada para no seguir generando errores. ${detail}`.trim();
}
