import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

let adminApp: App | null = null;
let adminDbInstance: Firestore | null = null;
let adminAuthInstance: Auth | null = null;

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

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
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


