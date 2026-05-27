/**
 * Cliente server-side: consulta nómina de colegios en LegalMev (fuente de verdad).
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
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(email: string, colegioId: string): string {
  return `${colegioId}::${email}`;
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
