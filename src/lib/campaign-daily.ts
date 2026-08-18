import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { enqueueCampaignDaily } from '@/lib/cloud-tasks';
import { nextCampaignMorning, upcomingDailyQuota } from '@/lib/campaign-tanda';

export function campaignIsStopped(data: { estado?: unknown }): boolean {
  const estado = String(data.estado || '');
  return estado === 'cancelada' || estado === 'pausada' || estado === 'completada';
}

export async function scheduleNextDailySend(campaignId: string): Promise<{ scheduled: boolean; dayKey?: string; at?: string }> {
  const db = getAdminDb();
  const campRef = db.collection('campaigns').doc(campaignId);
  const snap = await campRef.get();
  if (!snap.exists) return { scheduled: false };
  const campaign = snap.data() || {};
  if (campaignIsStopped(campaign)) return { scheduled: false };

  const total = typeof campaign.recipientCount === 'number' ? campaign.recipientCount : 0;
  const resume = typeof campaign.fanoutResumeOffset === 'number' ? campaign.fanoutResumeOffset : 0;
  const enviados = typeof campaign.stats?.enviados === 'number' ? campaign.stats.enviados : 0;
  if (total <= 0) return { scheduled: false };
  if (resume >= total && enviados >= total) return { scheduled: false };
  if (upcomingDailyQuota(campaign) <= 0 && campaign.simulated === true) return { scheduled: false };
  if (upcomingDailyQuota(campaign) <= 0 && typeof campaign.tandaSize === 'number' && campaign.tandaSize === 0) {
    return { scheduled: false };
  }

  const morning = nextCampaignMorning();
  await enqueueCampaignDaily(campaignId, morning.dayKey, morning.delaySeconds);
  await campRef.update({
    nextDailyDayKey: morning.dayKey,
    nextDailyAt: morning.at,
    updatedAt: FieldValue.serverTimestamp(),
  }).catch(() => undefined);
  return { scheduled: true, dayKey: morning.dayKey, at: morning.at.toISOString() };
}
