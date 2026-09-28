/** Mensaje que el content script de la extensión escucha en páginas admin de Notificas. */
export const LINKEDIN_EXTENSION_PREPARE_EVENT = "NOTIFICAS_LINKEDIN_ASSISTANT_PREPARE";

export type LinkedInExtensionPrepareAction = {
  memberId: string;
  campaignId: string;
  action: "connection" | "message" | "followup";
  message: string | null;
  contact: {
    name: string;
    firstName?: string | null;
    title?: string | null;
    companyName?: string | null;
    linkedinUrl: string;
  };
};

export type LinkedInExtensionPreparePayload = {
  memberId: string;
  campaignId: string;
  action: LinkedInExtensionPrepareAction;
};

/** Dispara preparación en la extensión (si está instalada). Devuelve false fuera del browser. */
export function requestLinkedInExtensionPrepare(payload: LinkedInExtensionPreparePayload): boolean {
  if (typeof window === "undefined") return false;
  window.postMessage(
    {
      type: LINKEDIN_EXTENSION_PREPARE_EVENT,
      payload,
    },
    window.location.origin,
  );
  return true;
}
