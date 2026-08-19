'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  doc,
  onSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Campaign, CampaignMessage, CanalCampaign } from '@/lib/types';

function mapCampaign(id: string, data: DocumentData): Campaign {
  return {
    id,
    orgId: String(data.orgId ?? ''),
    createdBy: String(data.createdBy ?? ''),
    nombre: String(data.nombre ?? ''),
    asunto: String(data.asunto ?? ''),
    cuerpo: String(data.cuerpo ?? ''),
    waTemplateName: data.waTemplateName,
    waTemplateLang: data.waTemplateLang,
    waTemplateVariables: Array.isArray(data.waTemplateVariables) ? data.waTemplateVariables : undefined,
    waUrlButton: data.waUrlButton === true,
    adjuntos: Array.isArray(data.adjuntos) ? data.adjuntos : [],
    recipientListId: data.recipientListId,
    recipientEmails: Array.isArray(data.recipientEmails) ? data.recipientEmails : [],
    recipientData: Array.isArray(data.recipientData) ? data.recipientData : [],
    recipientCount: typeof data.recipientCount === 'number' ? data.recipientCount : 0,
    tandaSize: typeof data.tandaSize === 'number' ? data.tandaSize : undefined,
    tandaDayKey: typeof data.tandaDayKey === 'string' ? data.tandaDayKey : undefined,
    tandaDayQuota: typeof data.tandaDayQuota === 'number' ? data.tandaDayQuota : undefined,
    tandaDaySentStart: typeof data.tandaDaySentStart === 'number' ? data.tandaDaySentStart : undefined,
    nextDailyAt: data.nextDailyAt,
    managedByAdmin: data.managedByAdmin === true,
    simulated: data.simulated === true,
    canal: (data.canal as CanalCampaign) || 'email',
    estado: data.estado as Campaign['estado'],
    stats: {
      total: data.stats?.total ?? 0,
      enviados: data.stats?.enviados ?? 0,
      leidos: data.stats?.leidos ?? 0,
      pendientes: data.stats?.pendientes ?? 0,
      errores: data.stats?.errores ?? 0,
    },
    createdAt: data.createdAt,
    scheduledAt: data.scheduledAt,
    startedAt: data.startedAt,
    completedAt: data.completedAt,
  };
}

function mapCampaignMessage(id: string, data: DocumentData): CampaignMessage {
  return {
    id,
    campaignId: String(data.campaignId ?? ''),
    orgId: String(data.orgId ?? ''),
    mailId: String(data.mailId ?? ''),
    recipientEmail: String(data.recipientEmail ?? ''),
    recipientNombre: String(data.recipientNombre ?? ''),
    recipientDni: data.recipientDni,
    recipientLegajo: data.recipientLegajo,
    recipientDias: data.recipientDias,
    recipientFecha: data.recipientFecha,
    recipientMonto: data.recipientMonto,
    recipientTelefono: data.recipientTelefono,
    estado: data.estado as CampaignMessage['estado'],
    enviadoAt: data.enviadoAt,
    leidoAt: data.leidoAt,
    txHashEnvio: data.txHashEnvio,
    txHashLectura: data.txHashLectura,
    errorMsg: data.errorMsg,
    emailEstado: data.emailEstado,
    emailEnviadoAt: data.emailEnviadoAt,
    emailLeidoAt: data.emailLeidoAt,
    emailClickAt: data.emailClickAt,
    emailClickCount: data.emailClickCount,
    emailTxEnvio: data.emailTxEnvio,
    emailTxLectura: data.emailTxLectura,
    emailError: data.emailError,
    waEstado: data.waEstado,
    waEnviadoAt: data.waEnviadoAt,
    waEntregadoAt: data.waEntregadoAt,
    waLeidoAt: data.waLeidoAt,
    waClickAt: data.waClickAt,
    waClickCount: data.waClickCount,
    waTxEnvio: data.waTxEnvio,
    waTxEntregado: data.waTxEntregado,
    waTxLeido: data.waTxLeido,
    waError: data.waError,
  };
}

/** Genera CampaignMessages sintéticos desde recipientData cuando la colección está vacía. */
function fallbackMessages(campaign: Campaign): CampaignMessage[] {
  const data = campaign.recipientData ?? [];
  const emails = campaign.recipientEmails ?? [];

  if (data.length > 0) {
    return data.map((r, i) => ({
      id: `fallback-${i}`,
      campaignId: campaign.id,
      orgId: campaign.orgId,
      mailId: '',
      recipientEmail: r.email ?? '',
      recipientNombre: r.nombre ?? '',
      recipientDni: r.dni,
      recipientLegajo: r.legajo,
      estado: 'enviado' as const,
    }));
  }

  return emails.map((email, i) => ({
    id: `fallback-${i}`,
    campaignId: campaign.id,
    orgId: campaign.orgId,
    mailId: '',
    recipientEmail: email,
    recipientNombre: email,
    estado: 'enviado' as const,
  }));
}

/**
 * Suscripción ligera: solo el doc de campaña (stats, estado).
 * Los mensajes se cargan por API paginada para soportar 150k+ destinatarios.
 * En modo admin no hay Firebase Auth: se consulta la API del panel.
 */
export function useCampaignProgress(campaignId: string | null, opts?: { admin?: boolean }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const admin = opts?.admin === true;

  useEffect(() => {
    if (!campaignId) {
      setCampaign(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    if (admin) {
      let cancelled = false;
      const load = async () => {
        try {
          const res = await fetch(`/api/admin/campaigns/${campaignId}`, { credentials: 'include' });
          const json = await res.json() as { campaign?: DocumentData };
          if (cancelled) return;
          if (!res.ok || !json.campaign) {
            setCampaign(null);
          } else {
            setCampaign(mapCampaign(campaignId, json.campaign));
          }
        } catch {
          if (!cancelled) setCampaign(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      void load();
      const t = setInterval(() => void load(), 4000);
      return () => {
        cancelled = true;
        clearInterval(t);
      };
    }

    const unsub = onSnapshot(
      doc(db, 'campaigns', campaignId),
      (snap) => {
        if (snap.exists()) setCampaign(mapCampaign(snap.id, snap.data()));
        else setCampaign(null);
        setLoading(false);
      },
      () => {
        setCampaign(null);
        setLoading(false);
      }
    );

    return unsub;
  }, [campaignId, admin]);

  const stats = useMemo(() => campaign?.stats ?? null, [campaign]);

  return { campaign, stats, loading };
}
