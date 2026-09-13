import { onAuthStateChanged, type Unsubscribe } from "firebase/auth";
import { auth } from "@/lib/firebase";

/** Subscribe to Firestore only after Auth has a user, and drop the listener on sign-out. */
export function listenWhenSignedIn(start: () => Unsubscribe, onSignedOut?: () => void): Unsubscribe {
  let unsubSnap: Unsubscribe | undefined;
  const unsubAuth = onAuthStateChanged(auth, (user) => {
    unsubSnap?.();
    unsubSnap = undefined;
    if (!user) {
      onSignedOut?.();
      return;
    }
    unsubSnap = start();
  });
  return () => {
    unsubSnap?.();
    unsubAuth();
  };
}
