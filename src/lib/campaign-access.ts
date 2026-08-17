import { NextRequest, NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/admin-session';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getOrgIfMember } from '@/lib/org-server';
import { getAdminDb } from '@/lib/firebase-admin';

export type CampaignAccess =
  | { ok: false; response: NextResponse }
  | { ok: true; viaAdmin: boolean; uid: string | null; email: string | null };

/**
 * Admin del panel o miembro de la org dueña de la campaña.
 */
export async function resolveCampaignOrgAccess(
  request: NextRequest,
  orgId: string,
  campaignId: string
): Promise<CampaignAccess> {
  if (!orgId || !campaignId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'campaignId y orgId requeridos' }, { status: 400 }),
    };
  }

  const camp = await getAdminDb().collection('campaigns').doc(campaignId).get();
  if (!camp.exists || String(camp.data()?.orgId) !== orgId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 }),
    };
  }

  if (hasAdminSession(request)) {
    return { ok: true, viaAdmin: true, uid: null, email: null };
  }

  const { decoded, errorResponse } = await verifyAuthToken(request);
  if (errorResponse) return { ok: false, response: errorResponse };
  const orgGate = await getOrgIfMember(decoded!.uid, orgId, decoded!.email);
  if (!orgGate) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }
  return { ok: true, viaAdmin: false, uid: decoded!.uid, email: decoded!.email ?? null };
}

/** `null` = autorizado. */
export async function requireCampaignOrgAccess(
  request: NextRequest,
  orgId: string,
  campaignId: string
): Promise<NextResponse | null> {
  const access = await resolveCampaignOrgAccess(request, orgId, campaignId);
  return access.ok ? null : access.response;
}

/** Para rutas que solo reciben campaignId (p.ej. listado de mensajes). */
export async function requireCampaignViewer(
  request: NextRequest,
  campaignId: string
): Promise<NextResponse | null> {
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId requerido' }, { status: 400 });
  }
  const camp = await getAdminDb().collection('campaigns').doc(campaignId).get();
  if (!camp.exists) {
    return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
  }
  const orgId = String(camp.data()?.orgId || '');
  return requireCampaignOrgAccess(request, orgId, campaignId);
}
