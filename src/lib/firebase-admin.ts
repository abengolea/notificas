import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage, type Storage } from "firebase-admin/storage";

let adminApp: App | null = null;
let adminDbInstance: Firestore | null = null;
let adminAuthInstance: Auth | null = null;
let adminStorageInstance: Storage | null = null;

function createAdminApp(): App {
  if (getApps().length) {
    return getApp();
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are not fully configured.");
  }

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    `${projectId}.appspot.com`;

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
    storageBucket,
  });
}

/**
 * Obtiene la instancia de Firestore. Inicialización lazy para evitar
 * errores durante el build de Next.js (cuando las credenciales aún no están disponibles).
 */
export function getAdminDb(): Firestore {
  if (!adminDbInstance) {
    try {
      adminApp = createAdminApp();
      adminDbInstance = getFirestore(adminApp);
    } catch (error) {
      console.error("Failed to initialize Firebase Admin SDK:", error);
      throw error;
    }
  }
  return adminDbInstance;
}

/** @deprecated Usar getAdminDb() en rutas API. Mantenido para compatibilidad durante migración. */
export const adminDb = new Proxy({} as Firestore, {
  get(_, prop) {
    return (getAdminDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export function getAdminAuth(): Auth {
  if (!adminAuthInstance) {
    try {
      adminApp = adminApp ?? createAdminApp();
      adminAuthInstance = getAuth(adminApp);
    } catch (error) {
      console.error("Failed to initialize Firebase Admin Auth:", error);
      throw error;
    }
  }
  return adminAuthInstance;
}

/** Proxy lazy para Auth — misma convención que adminDb */
export const adminAuth = new Proxy({} as Auth, {
  get(_, prop) {
    return (getAdminAuth() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export function getAdminStorage(): Storage {
  if (!adminStorageInstance) {
    try {
      adminApp = adminApp ?? createAdminApp();
      adminStorageInstance = getStorage(adminApp);
    } catch (error) {
      console.error("Failed to initialize Firebase Admin Storage:", error);
      throw error;
    }
  }
  return adminStorageInstance;
}

/** Bucket de trabajo (Firebase). Campañas y URLs de descarga viven acá. */
export function getAdminBucket() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '';
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    `${projectId}.appspot.com`;
  return getAdminStorage().bucket(bucketName);
}

/** Copia WORM: adjuntos y certificados. No se pisan ni se borran durante 5 años. */
export const EVIDENCE_BUCKET_NAME =
  process.env.EVIDENCE_STORAGE_BUCKET || 'notificas-f9953-evidence';

export function getEvidenceBucket() {
  return getAdminStorage().bucket(EVIDENCE_BUCKET_NAME);
}

export function isEvidenceObjectPath(path: string): boolean {
  return (
    path.startsWith('pdfs/') ||
    path.startsWith('certificates/') ||
    path.startsWith('evidence-snapshots/') ||
    path.startsWith('campaign-source/') ||
    path.startsWith('provider-webhooks/')
  );
}

export function wormSnapshotPath(mailId: string) {
  return `evidence-snapshots/${mailId}.json`;
}

function jsonReplacer(_key: string, value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
      try {
        return (value as { toDate: () => Date }).toDate().toISOString();
      } catch {
        return value;
      }
    }
    const secs = (value as { seconds?: number; _seconds?: number }).seconds
      ?? (value as { _seconds?: number })._seconds;
    if (typeof secs === 'number') return new Date(secs * 1000).toISOString();
  }
  return value;
}

/** Expediente sellado en el bucket lacrado. Si ya existe, no pisa (WORM). */
export async function writeWormSnapshot(mailId: string, snapshot: unknown): Promise<void> {
  if (!mailId) return;
  const file = getEvidenceBucket().file(wormSnapshotPath(mailId));
  const [exists] = await file.exists();
  if (exists) return;
  const body = JSON.stringify(snapshot, jsonReplacer);
  try {
    await file.save(Buffer.from(body, 'utf8'), {
      resumable: false,
      contentType: 'application/json; charset=utf-8',
      metadata: { cacheControl: 'private,max-age=31536000' },
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? Number((e as { code?: number }).code) : 0;
    if (code === 412) return;
    throw e;
  }
}

/** Copia al bucket lacrado si aún no existe. Un overwrite ahí lo rechaza GCS. */
export async function sealEvidenceCopy(path: string): Promise<void> {
  if (!path || !isEvidenceObjectPath(path)) return;
  const dest = getEvidenceBucket().file(path);
  const [exists] = await dest.exists();
  if (exists) return;
  await getAdminBucket().file(path).copy(dest);
}


