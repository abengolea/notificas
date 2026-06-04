"use client";

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileEdit, PenSquare, Trash2 } from 'lucide-react';

import {
  clearComposeDraft,
  COMPOSE_DRAFT_CHANGED_EVENT,
  openComposeDialog,
  readComposeDraft,
  type ComposeDraft,
} from '@/lib/compose-draft';
import { stripRichTextToPlainText } from '@/lib/rich-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type ComposeDraftPanelProps = {
  uid: string;
};

export function ComposeDraftPanel({ uid }: ComposeDraftPanelProps) {
  const [draft, setDraft] = useState<ComposeDraft | null>(null);

  useEffect(() => {
    const refresh = () => setDraft(readComposeDraft(uid));
    refresh();

    window.addEventListener(COMPOSE_DRAFT_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);

    return () => {
      window.removeEventListener(COMPOSE_DRAFT_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [uid]);

  if (!draft) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <FileEdit className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="font-medium text-foreground">No hay borradores</p>
        <p className="mt-1 text-sm">
          Si cerrás la ventana de redacción sin enviar, el mensaje queda guardado acá.
        </p>
      </Card>
    );
  }

  const preview = stripRichTextToPlainText(draft.content || '').trim();
  const savedLabel = draft.savedAt
    ? formatDistanceToNow(new Date(draft.savedAt), { addSuffix: true, locale: es })
    : null;

  return (
    <Card className="overflow-hidden shadow-md">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <FileEdit className="h-5 w-5 shrink-0 text-primary" />
            <h2 className="font-semibold">Mensaje certificado sin enviar</h2>
            {savedLabel && (
              <span className="text-xs text-muted-foreground">Guardado {savedLabel}</span>
            )}
          </div>
          {draft.subject?.trim() && (
            <p className="text-sm font-medium">{draft.subject.trim()}</p>
          )}
          {draft.recipient?.trim() && (
            <p className="text-sm">
              <span className="text-muted-foreground">Para: </span>
              <span className="font-medium text-primary">{draft.recipient.trim()}</span>
            </p>
          )}
          {draft.recipientPhone?.trim() && (
            <p className="text-sm text-muted-foreground">
              WhatsApp: {draft.recipientPhone.trim()}
            </p>
          )}
          {preview ? (
            <p className="line-clamp-3 text-sm text-muted-foreground">{preview}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">Sin contenido todavía</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" onClick={() => openComposeDialog()}>
            <PenSquare className="mr-2 h-4 w-4" />
            Continuar redactando
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => clearComposeDraft(uid)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Descartar
          </Button>
        </div>
      </div>
    </Card>
  );
}
