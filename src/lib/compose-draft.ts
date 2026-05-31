import { stripRichTextToPlainText } from '@/lib/rich-text';

export type ComposeDraft = {
  recipient: string;
  recipientPhone: string;
  content: string;
  savedAt: number;
};

export const COMPOSE_DRAFT_CHANGED_EVENT = 'notificas:compose-draft-changed';
export const OPEN_COMPOSE_EVENT = 'notificas:open-compose';

export function composeDraftKey(uid: string) {
  return `notificas-compose-draft:${uid}`;
}

export function hasComposeDraftContent(
  draft: Pick<ComposeDraft, 'recipient' | 'recipientPhone' | 'content'>,
) {
  return (
    !!draft.recipient?.trim() ||
    !!draft.recipientPhone?.trim() ||
    stripRichTextToPlainText(draft.content || '').length > 0
  );
}

export function readComposeDraft(uid: string): ComposeDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(composeDraftKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ComposeDraft;
    if (!parsed || typeof parsed.content !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function notifyComposeDraftChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(COMPOSE_DRAFT_CHANGED_EVENT));
}

export function writeComposeDraft(uid: string, draft: ComposeDraft) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(composeDraftKey(uid), JSON.stringify(draft));
    notifyComposeDraftChanged();
  } catch {
    // Ignorar quota exceeded u otros errores de almacenamiento
  }
}

export function clearComposeDraft(uid: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(composeDraftKey(uid));
    notifyComposeDraftChanged();
  } catch {
    // noop
  }
}

export function hasPendingComposeDraft(uid: string): boolean {
  const draft = readComposeDraft(uid);
  return draft != null && hasComposeDraftContent(draft);
}

export function openComposeDialog() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_COMPOSE_EVENT));
}
