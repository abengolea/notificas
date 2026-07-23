/**
 * Cliente server-side: consulta nómina de colegios y usuarios registrados en LegalMev.
 */

export type LegalMevVerifyResult = {
  isMember: boolean;
  onList: boolean;
  colegioId?: string;
  colegioName?: string;
  memberName?: string;
  estado?: "activo" | "suspendido";
  convenioActivo: boolean;
};

export type LegalMevRegisteredVerifyResult = {
  isRegistered: boolean;
  hasConvenio: boolean;
  discountTier: "convenio" | "legalmev" | null;
  discountPercent: number;
  freeShipments: number;
  userName?: string;
  colegioId?: string;
  colegioName?: string;
};

export type LegalMevColegioSummary = {
  id: string;
  name: string;
  convenioActivo: boolean;
  memberCount: number;
};

function baseUrl(): string | undefined {
  const raw =
    process.env.LEGALMEV_URL?.trim() ||
    process.env.NEXT_PUBLIC_LEGALMEV_URL?.trim();
  if (!raw) return undefined;
  return raw.replace(/\/+$/, "");
}

function sharedSecret(): string | undefined {
  const raw =
    process.env.NOTIFICAS_LEGALMEV_SHARED_SECRET?.trim() ||
    process.env.LEGALMEV_NOTIFICAS_SHARED_SECRET?.trim();
  return raw || undefined;
}

export function isLegalMevColegioConfigured(): boolean {
  return Boolean(baseUrl() && sharedSecret());
}

/** Cache en memoria por proceso (evita llamar a LegalMev en cada refresh de billetera). */
const verifyCache = new Map<string, { at: number; data: LegalMevVerifyResult }>();
const registeredCache = new Map<string, { at: number; data: LegalMevRegisteredVerifyResult }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(email: string, colegioId: string): string {
  return `${colegioId}::${email}`;
}

function legalmevRegisteredDiscountPercent(): number {
  const raw = process.env.LEGALMEV_REGISTERED_DISCOUNT_PERCENT?.trim();
  const n = raw ? Number(raw) : 20;
  if (!Number.isFinite(n) || n < 0 || n > 100) return 20;
  return Math.floor(n);
}

/**
 * Verifica membresía en un colegio concreto de LegalMev.
 * @param colegioId ID del documento en LegalMev `colegios/{id}`
 */
export async function verifyLegalMevColegioMember(
  email: string,
  colegioId: string,
): Promise<LegalMevVerifyResult> {
  const fallback: LegalMevVerifyResult = {
    isMember: false,
    onList: false,
    convenioActivo: false,
  };

  const url = baseUrl();
  const secret = sharedSecret();
  if (!url || !secret || !colegioId.trim()) return fallback;

  const norm = email.trim().toLowerCase();
  const key = cacheKey(norm, colegioId);
  const cached = verifyCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const res = await fetch(`${url}/api/integrations/notificas/verify-member`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ email: norm, colegioId: colegioId.trim() }),
      signal: AbortSignal.timeout(12_000),
    });

    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      console.error("[legalmev-colegio] verify-member HTTP", res.status, j);
      return fallback;
    }

    const data: LegalMevVerifyResult = {
      isMember: j.isMember === true,
      onList: j.onList === true,
      colegioId: typeof j.colegioId === "string" ? j.colegioId : undefined,
      colegioName: typeof j.colegioName === "string" ? j.colegioName : undefined,
      memberName: typeof j.memberName === "string" ? j.memberName : undefined,
      estado: j.estado === "suspendido" ? "suspendido" : j.estado === "activo" ? "activo" : undefined,
      convenioActivo: j.convenioActivo === true,
    };

    verifyCache.set(key, { at: Date.now(), data });
    return data;
  } catch (e) {
    console.error("[legalmev-colegio] verify-member", e);
    return fallback;
  }
}

/**
 * Verifica si el email es usuario LegalMev y qué descuento Notificas le corresponde
 * (convenio 50% o registrado 20% sin envíos gratis).
 */
export async function verifyLegalMevRegisteredUser(
  email: string,
): Promise<LegalMevRegisteredVerifyResult> {
  const fallback: LegalMevRegisteredVerifyResult = {
    isRegistered: false,
    hasConvenio: false,
    discountTier: null,
    discountPercent: 0,
    freeShipments: 0,
  };

  const url = baseUrl();
  const secret = sharedSecret();
  if (!url || !secret) return fallback;

  const norm = email.trim().toLowerCase();
  if (!norm.includes("@")) return fallback;

  const cached = registeredCache.get(norm);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const res = await fetch(`${url}/api/integrations/notificas/verify-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ email: norm }),
      signal: AbortSignal.timeout(12_000),
    });

    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      console.error("[legalmev-colegio] verify-user HTTP", res.status, j);
      return fallback;
    }

    const tier: "convenio" | "legalmev" | null =
      j.discountTier === "convenio" || j.discountTier === "legalmev" ? j.discountTier : null;
    const pctFromApi =
      typeof j.discountPercent === "number" && Number.isFinite(j.discountPercent)
        ? Math.min(100, Math.max(0, Math.floor(j.discountPercent)))
        : 0;
    const freeShipments =
      typeof j.freeShipments === "number" && Number.isFinite(j.freeShipments) && j.freeShipments > 0
        ? Math.floor(j.freeShipments)
        : 0;

    let discountPercent = pctFromApi;
    let discountTier: "convenio" | "legalmev" | null = tier;
    if (j.isRegistered === true && !discountTier && discountPercent <= 0) {
      discountTier = "legalmev";
      discountPercent = legalmevRegisteredDiscountPercent();
    }

    const data: LegalMevRegisteredVerifyResult = {
      isRegistered: j.isRegistered === true,
      hasConvenio: j.hasConvenio === true,
      discountTier,
      discountPercent: discountTier ? discountPercent : 0,
      freeShipments: discountTier === "convenio" ? freeShipments : 0,
      userName: typeof j.userName === "string" ? j.userName : undefined,
      colegioId: typeof j.colegioId === "string" ? j.colegioId : undefined,
      colegioName: typeof j.colegioName === "string" ? j.colegioName : undefined,
    };

    registeredCache.set(norm, { at: Date.now(), data });
    return data;
  } catch (e) {
    console.error("[legalmev-colegio] verify-user", e);
    return fallback;
  }
}

export type LegalMevMemberRow = {
  email: string;
  name: string;
  estado: "activo" | "suspendido";
};

export async function listLegalMevColegioMembers(
  colegioId: string,
): Promise<{
  colegioName: string;
  convenioActivo: boolean;
  members: LegalMevMemberRow[];
}> {
  const empty = { colegioName: "", convenioActivo: false, members: [] as LegalMevMemberRow[] };
  const url = baseUrl();
  const secret = sharedSecret();
  if (!url || !secret || !colegioId.trim()) return empty;

  try {
    const res = await fetch(
      `${url}/api/integrations/notificas/colegios/${encodeURIComponent(colegioId.trim())}/members`,
      {
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      },
    );
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || !Array.isArray(j.members)) return empty;
    const members = (j.members as LegalMevMemberRow[]).filter(
      (m) => typeof m.email === "string" && m.email.includes("@"),
    );
    return {
      colegioName: typeof j.colegioName === "string" ? j.colegioName : "",
      convenioActivo: j.convenioActivo === true,
      members,
    };
  } catch (e) {
    console.error("[legalmev-colegio] list members", e);
    return empty;
  }
}

/** Lista colegios en LegalMev (admin Notificas para vincular IDs). */
export async function listLegalMevColegios(): Promise<LegalMevColegioSummary[]> {
  const url = baseUrl();
  const secret = sharedSecret();
  if (!url || !secret) return [];

  try {
    const res = await fetch(`${url}/api/integrations/notificas/colegios`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || !Array.isArray(j.colegios)) return [];
    return (j.colegios as LegalMevColegioSummary[]).filter(
      (c) => typeof c.id === "string" && typeof c.name === "string",
    );
  } catch (e) {
    console.error("[legalmev-colegio] list colegios", e);
    return [];
  }
}
