'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Campaign, CampaignMessage } from '@/lib/types';

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
    estado: data.estado as CampaignMessage['estado'],
    enviadoAt: data.enviadoAt,
    leidoAt: data.leidoAt,
    txHashEnvio: data.txHashEnvio,
    txHashLectura: data.txHashLectura,
    errorMsg: data.errorMsg,
  };
}

export function useCampaignProgress(campaignId: string | null) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campaignId) {
      setCampaign(null);
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubCamp = onSnapshot(
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

    const q = query(collection(db, 'campaign_messages'), where('campaignId', '==', campaignId));

    const unsubMsg = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => mapCampaignMessage(d.id, d.data()));
        list.sort((a, b) => a.recipientEmail.localeCompare(b.recipientEmail));
        setMessages(list);
        setLoading(false);
      },
      () => {
        setMessages([]);
        setLoading(false);
      }
    );

    return () => {
      unsubCamp();
      unsubMsg();
    };
  }, [campaignId]);

  const stats = useMemo(() => campaign?.stats ?? null, [campaign]);

  return { campaign, messages, stats, loading };
}
