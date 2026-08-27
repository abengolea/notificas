"use client";

import { useEffect } from "react";

import { matchAiReferrerHost, utmParamsFromSearch } from "@/lib/ai-referrers";

const SESSION_UTM_KEY = "notificas_utm";
const SESSION_AI_KEY = "notificas_ai_ref";

/**
 * Conserva UTM y referers de asistentes de IA y los envía a Firebase Analytics.
 * Carga Analytics en diferido para no bloquear el HTML público.
 */
export function AiReferralTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const utm = utmParamsFromSearch(window.location.search);
    if (Object.keys(utm).length) {
      try {
        sessionStorage.setItem(SESSION_UTM_KEY, JSON.stringify(utm));
      } catch {
        /* ignore quota */
      }
    }

    let aiSource: string | null = null;
    try {
      const referrerHost = document.referrer ? new URL(document.referrer).hostname : "";
      aiSource = referrerHost ? matchAiReferrerHost(referrerHost) : null;
      if (aiSource) sessionStorage.setItem(SESSION_AI_KEY, aiSource);
      else aiSource = sessionStorage.getItem(SESSION_AI_KEY);
    } catch {
      aiSource = null;
    }

    let storedUtm: Record<string, string> = utm;
    try {
      if (!Object.keys(storedUtm).length) {
        storedUtm = JSON.parse(sessionStorage.getItem(SESSION_UTM_KEY) || "{}") as Record<
          string,
          string
        >;
      }
    } catch {
      storedUtm = utm;
    }

    if (!aiSource && !Object.keys(storedUtm).length) return;

    void import("@/lib/firebase")
      .then(async ({ app }) => {
        const { getAnalytics, isSupported, logEvent } = await import("firebase/analytics");
        if (!(await isSupported())) return;
        const analytics = getAnalytics(app);
        const params: Record<string, string> = {
          page_path: window.location.pathname,
          ...storedUtm,
        };
        if (aiSource) params.ai_source = aiSource;
        logEvent(analytics, aiSource ? "ai_referral" : "campaign_hit", params);
      })
      .catch(() => {
        /* Analytics opcional en páginas públicas */
      });
  }, []);

  return null;
}
