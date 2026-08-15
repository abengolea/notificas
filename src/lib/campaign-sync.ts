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
    adjuntos: Array.isArray(data.adjuntos) ? data.adjuntos : [],
    recipientListId: data.recipientListId,
    recipientEmails: Array.isArray(data.recipientEmails) ? data.recipientEmails : [],
    recipientData: Array.isArray(data.recipientData) ? data.recipientData : [],
    recipientCount: typeof data.recipientCount === 'number' ? data.recipientCount : 0,
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
    emailTxEnvio: data.emailTxEnvio,
    emailTxLectura: data.emailTxLectura,
    emailError: data.emailError,
    waEstado: data.waEstado,
    waEnviadoAt: data.waEnviadoAt,
    waEntregadoAt: data.waEntregadoAt,
    waLeidoAt: data.waLeidoAt,
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
 */
export function useCampaignProgress(campaignId: string | null) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campaignId) {
      setCampaign(null);
      setLoading(false);
      return;
    }

    setLoading(true);
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
  }, [campaignId]);

  const stats = useMemo(() => campaign?.stats ?? null, [campaign]);

  return { campaign, stats, loading };
}
