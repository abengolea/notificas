"use client";

import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { toast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";

const SNAPSHOT_DEFER_MS = 150;

function mailDocSubject(data: Record<string, unknown>): string {
  const msg = data?.message as { subject?: string } | undefined;
  const s = msg?.subject?.trim();
  return s || "Sin asunto";
}

const TRACKING_TOAST_TYPES = new Set([
  "email_opened",
  "app_opened",
  "read_confirmed",
  "attachment_opened",
  "link_clicked",
  "whatsapp_link_clicked",
]);

function trackingToastTitle(type: string): string {
  switch (type) {
    case "email_opened":
      return "Abrieron el correo";
    case "app_opened":
      return "Abrieron el mensaje en la app";
    case "read_confirmed":
      return "Lectura confirmada";
    case "attachment_opened":
      return "Abrieron un adjunto";
    case "link_clicked":
      return "Clic en un enlace";
    case "whatsapp_link_clicked":
      return "Clic en enlace de WhatsApp";
    default:
      return "Nueva actividad";
  }
}

function shouldToastMovement(m: { type?: string; viewerIsSender?: boolean }): boolean {
  const t = m.type;
  if (!t || !TRACKING_TOAST_TYPES.has(t)) return false;
  if (t === "app_opened" && m.viewerIsSender) return false;
  return true;
}

function getMovementsFromDoc(data: Record<string, unknown>): unknown[] {
  const tr = data?.tracking as { movements?: unknown[] } | undefined;
  return Array.isArray(tr?.movements) ? tr.movements : [];
}

/**
 * Toasts en tiempo real mientras el usuario está en /dashboard:
 * mensajes nuevos en bandeja y aperturas/clics en envíos propios.
 */
export function MailActivityToasts() {
  const sentMoveCountRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    let unsubMailInbox: (() => void) | undefined;
    let unsubMailSent: (() => void) | undefined;
    let deferHandle: ReturnType<typeof setTimeout> | undefined;
    let listenGen = 0;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      listenGen += 1;
      const gen = listenGen;

      unsubMailInbox?.();
      unsubMailSent?.();
      unsubMailInbox = undefined;
      unsubMailSent = undefined;
      if (deferHandle !== undefined) clearTimeout(deferHandle);
      deferHandle = undefined;

      if (!u?.email?.trim() || !u.uid) {
        sentMoveCountRef.current.clear();
        return;
      }

      deferHandle = setTimeout(() => {
        void (async () => {
          await auth.authStateReady();
          if (gen !== listenGen) return;
          const u2 = auth.currentUser;
          if (!u2?.email?.trim()) return;
          try {
            await u2.getIdToken(true);
          } catch {
            return;
          }
          if (gen !== listenGen) return;

          const userEmailNorm = u2.email.trim().toLowerCase();
          const mailCol = collection(db, "mail");

          let inboxFirst = true;
          const qInbox = query(mailCol, where("recipientEmail", "==", userEmailNorm));
          unsubMailInbox = onSnapshot(
            qInbox,
            { includeMetadataChanges: false },
            (snap) => {
              if (gen !== listenGen) return;
              if (inboxFirst) {
                inboxFirst = false;
                return;
              }
              for (const ch of snap.docChanges()) {
                if (ch.type !== "added") continue;
                const subj = mailDocSubject(ch.doc.data() as Record<string, unknown>);
                toast({
                  title: "Nueva notificación recibida",
                  description: subj,
                });
              }
            },
            (err) => console.error("MailActivityToasts inbox:", err?.code ?? err),
          );

          let sentFirst = true;
          const qSent = query(mailCol, where("createdBy", "==", u2.uid));
          unsubMailSent = onSnapshot(
            qSent,
            { includeMetadataChanges: false },
            (snap) => {
              if (gen !== listenGen) return;
              if (sentFirst) {
                sentFirst = false;
                const m = sentMoveCountRef.current;
                m.clear();
                for (const d of snap.docs) {
                  const mov = getMovementsFromDoc(d.data() as Record<string, unknown>);
                  m.set(d.id, mov.length);
                }
                return;
              }

              for (const ch of snap.docChanges()) {
                const data = ch.doc.data() as Record<string, unknown>;
                const mov = getMovementsFromDoc(data);

                if (ch.type === "removed") {
                  sentMoveCountRef.current.delete(ch.doc.id);
                  continue;
                }

                if (ch.type === "added") {
                  sentMoveCountRef.current.set(ch.doc.id, mov.length);
                  continue;
                }

                if (ch.type !== "modified") continue;

                const prev = sentMoveCountRef.current.get(ch.doc.id) ?? 0;
                sentMoveCountRef.current.set(ch.doc.id, mov.length);
                if (mov.length <= prev) continue;

                const newSlice = mov.slice(prev) as { type?: string; viewerIsSender?: boolean }[];
                const subj = mailDocSubject(data);
                for (const mvt of newSlice) {
                  if (!shouldToastMovement(mvt)) continue;
                  toast({
                    title: trackingToastTitle(mvt.type || ""),
                    description: subj,
                  });
                }
              }
            },
            (err) => console.error("MailActivityToasts sent:", err?.code ?? err),
          );
        })();
      }, SNAPSHOT_DEFER_MS);
    });

    return () => {
      listenGen += 1;
      unsubAuth();
      unsubMailInbox?.();
      unsubMailSent?.();
      if (deferHandle !== undefined) clearTimeout(deferHandle);
    };
  }, []);

  return null;
}
