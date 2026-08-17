import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * Marca el primer click del enlace en campaign_messages.
 * `whatsapp`: click del link en el mensaje WA.
 * `email`: click del CTA / enlace del correo.
 * `auto`: campañas solo-WA (el reader URL ES el link del mensaje).
 */
export async function syncCampaignMessageLinkClick(
  mailId: string,
  source: 'whatsapp' | 'email' | 'auto' = 'auto'
): Promise<void> {
  try {
    const db = getAdminDb();
    const snap = await db.collection('campaign_messages').where('mailId', '==', mailId).limit(1).get();
    if (snap.empty) return;

    const ref = snap.docs[0].ref;
    const data = snap.docs[0].data();
    const campId = String(data.campaignId || '');
    const canal: string = campId
      ? String((await db.collection('campaigns').doc(campId).get()).data()?.canal || 'email')
      : 'email';

    const asWhatsApp =
      source === 'whatsapp' || (source === 'auto' && canal === 'whatsapp');
    const asEmail = source === 'email';

    const update: Record<string, unknown> = {};
    if (asWhatsApp && !data.waClickAt) {
      update.waClickAt = FieldValue.serverTimestamp();
      update.waClickCount = FieldValue.increment(1);
    } else if (asEmail && !data.emailClickAt) {
      update.emailClickAt = FieldValue.serverTimestamp();
      update.emailClickCount = FieldValue.increment(1);
    }
    if (Object.keys(update).length) await ref.update(update);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('⚠️ syncCampaignMessageLinkClick:', message);
  }
}
