import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { closeOpenBatches } from '@/lib/campaign-integrity';
import { emitBatchCompletedIfApi } from '@/lib/public-api/status-sync';

/** Marca la campaña completada si ya no quedan pendientes (y cierra tandas Merkle). */
export async function maybeCompleteCampaign(
  campRef: FirebaseFirestore.DocumentReference
): Promise<void> {
  const campSnap = await campRef.get();
  const campData = campSnap.data() ?? {};
  if (campData.estado === 'completada' || campData.estado === 'cancelada' || campData.estado === 'pausada') return;
  const st = (campData.stats || {}) as { pendientes?: number; enviados?: number; total?: number };
  const pendientes = typeof st.pendientes === 'number' ? st.pendientes : 0;
  if (pendientes > 0) return;
  const total =
    typeof campData.recipientCount === 'number' && campData.recipientCount > 0
      ? campData.recipientCount
      : typeof st.total === 'number'
        ? st.total
        : 0;
  const resume = typeof campData.fanoutResumeOffset === 'number' ? campData.fanoutResumeOffset : 0;
  const enviados = typeof st.enviados === 'number' ? st.enviados : 0;
  // Tanda diaria: todavía quedan destinatarios para mañana.
  if (total > 0 && resume < total && enviados < total) return;

  await campRef.update({
    estado: 'completada',
    completedAt: FieldValue.serverTimestamp(),
    'stats.pendientes': 0,
    fanoutActive: false,
  });

  const prepaid = typeof campData.creditsPrepaidAmount === 'number' ? campData.creditsPrepaidAmount : 0;
  const alreadyRefunded = typeof campData.creditsRefunded === 'number' ? campData.creditsRefunded : 0;
  const success = typeof st.enviados === 'number' ? st.enviados : 0;
  const refund = Math.max(0, prepaid - success - alreadyRefunded);
  const uid = String(campData.senderUid || campData.createdBy || '');
  if (refund > 0 && uid && campData.managedByAdmin !== true) {
    await getAdminDb().collection('users').doc(uid).update({
      creditos: FieldValue.increment(refund),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await campRef.update({ creditsRefunded: alreadyRefunded + refund });
  }

  void closeOpenBatches(campRef.id, true).catch((e) =>
    console.warn('⚠️ No se pudieron cerrar tandas al completar:', e?.message)
  );
  void emitBatchCompletedIfApi(campRef.id).catch((e) =>
    console.warn('public-api batch completed:', e instanceof Error ? e.message : e)
  );
}
