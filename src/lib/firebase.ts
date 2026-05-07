// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

/** En App Hosting, el build inyecta FIREBASE_WEBAPP_CONFIG (JSON); ver docs de Firebase. */
type FirebaseWebAppConfigJson = {
  apiKey?: string;
  appId?: string;
  authDomain?: string;
  messagingSenderId?: string;
  projectId?: string;
  storageBucket?: string;
};

function readFirebaseWebAppConfig(): FirebaseWebAppConfigJson | null {
  const raw = process.env.FIREBASE_WEBAPP_CONFIG;
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as FirebaseWebAppConfigJson;
  } catch {
    return null;
  }
}

const fh = readFirebaseWebAppConfig();

// Acceso estático a process.env.* — en el cliente Webpack solo inyecta NEXT_PUBLIC_
// si la clave es literal; `process.env[key]` dinámico queda undefined y rompe la validación.
const firebaseEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? fh?.apiKey,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? fh?.authDomain,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? fh?.projectId,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? fh?.storageBucket,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? fh?.messagingSenderId,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? fh?.appId,
} as const;

const requiredKeys = Object.keys(firebaseEnv) as (keyof typeof firebaseEnv)[];
const missingEnvVars = requiredKeys.filter((key) => !firebaseEnv[key]);

if (missingEnvVars.length > 0) {
  const msg = `Firebase: variables de entorno faltantes: ${missingEnvVars.join(', ')}`;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(msg);
  } else {
    console.error('❌', msg);
  }
}

const firebaseConfig = {
  apiKey: firebaseEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: firebaseEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: firebaseEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: firebaseEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: firebaseEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: firebaseEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

/**
 * Analytics en el cliente: getAnalytics() sincronizado al cargar el chunk rompe a veces
 * en producción (Next/Webpack: orden de registro de componentes). Carga perezosa + isSupported.
 */
let analytics: import("firebase/analytics").Analytics | undefined;
if (typeof window !== "undefined") {
  void import("firebase/analytics")
    .then(({ getAnalytics, isSupported }) =>
      isSupported().then((ok) => {
        if (!ok) return;
        try {
          analytics = getAnalytics(app);
        } catch (e) {
          console.warn("[Firebase] Analytics no disponible:", e);
        }
      }),
    )
    .catch((e) => console.warn("[Firebase] Analytics no cargado:", e));
}

export { app, auth, db, storage, analytics };
