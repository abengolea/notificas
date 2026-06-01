"use client";

import { useEffect, useState } from 'react';

import {
  COMPOSE_DRAFT_CHANGED_EVENT,
  hasPendingComposeDraft,
} from '@/lib/compose-draft';

export function useComposeDraftPending(uid: string | undefined) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!uid) {
      setPending(false);
      return;
    }

    const refresh = () => setPending(hasPendingComposeDraft(uid));
    refresh();

    window.addEventListener(COMPOSE_DRAFT_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);

    return () => {
      window.removeEventListener(COMPOSE_DRAFT_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [uid]);

  return pending;
}
