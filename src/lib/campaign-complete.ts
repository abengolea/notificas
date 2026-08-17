import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { closeOpenBatches } from '@/lib/campaign-integrity';

/** Marca la campaña completada si ya no quedan pendientes (y cierra tandas Merkle). */
export async function maybeCompleteCampaign(
  campRef: FirebaseFirestore.DocumentReference
): Promise<void> {
  const campSnap = await campRef.get();
  const campData = campSnap.data() ?? {};
  if (campData.estado === 'completada' || campData.estado === 'cancelada') return;
  const st = (campData.stats || {}) as { pendientes?: number; enviados?: number; total?: number };
  const pendientes = typeof st.pendientes === 'number' ? st.pendientes : 0;
  if (pendientes > 0) return;

  await campRef.update({
    estado: 'completada',
    completedAt: FieldValue.serverTimestamp(),
    'stats.pendientes': 0,
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
}
