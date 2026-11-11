import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  DEFAULT_MESSAGE_KIND,
  MESSAGE_KINDS,
  messageDisclaimerText,
  messageKindCopy,
  messageKindPreviewFallback,
  messageKindSentLine,
  normalizeMessageKind,
} from './message-kind';

test('un valor desconocido o ausente cae en el tipo por defecto (mensajes viejos)', () => {
  assert.equal(DEFAULT_MESSAGE_KIND, 'notificacion');
  assert.equal(normalizeMessageKind(undefined), 'notificacion');
  assert.equal(normalizeMessageKind(''), 'notificacion');
  assert.equal(normalizeMessageKind('carta'), 'notificacion');
  assert.equal(normalizeMessageKind(' Intimacion '), 'intimacion');
});

test('cada tipo es coherente: etiqueta, botón y frase dicen lo mismo', () => {
  for (const kind of MESSAGE_KINDS) {
    const { badge, noun, button } = messageKindCopy(kind);
    assert.equal(badge, noun.toUpperCase());
    assert.equal(button, `Acceder a la ${noun}`);
    assert.equal(messageKindSentLine(kind, 'Ana'), `Ana le envió una ${noun}.`);
    assert.match(messageKindPreviewFallback(kind, 'Ana'), new RegExp(`^${noun[0].toUpperCase()}${noun.slice(1)} de Ana`));
  }
});

test('el aviso usa el sustantivo del tipo elegido y conserva el texto pedido', () => {
  const t = messageDisclaimerText('intimacion');
  assert.match(t, /^Importante: este correo contiene una intimación cuyo contenido se encuentra disponible en el enlace indicado\./);
  assert.match(t, /Recomendamos acceder y leerla a la brevedad\./);
  assert.match(t, /no necesariamente impide que la intimación produzca los efectos que correspondan\./);
  assert.match(t, /El envío, el acceso y la lectura quedan registrados\.$/);
  assert.match(messageDisclaimerText('comunicacion'), /una comunicación cuyo/);
  assert.match(messageDisclaimerText(undefined), /una notificación cuyo/);
});

test('las Functions usan exactamente los mismos textos que la web (no se pueden desalinear)', () => {
  const fn = createRequire(import.meta.url)('../../functions/message-kind.js') as {
    MESSAGE_KINDS: string[];
    messageKindCopy: (k: string) => { badge: string; noun: string; button: string };
    messageDisclaimerText: (k: string) => string;
  };
  assert.deepEqual([...fn.MESSAGE_KINDS], [...MESSAGE_KINDS]);
  for (const kind of MESSAGE_KINDS) {
    assert.deepEqual(fn.messageKindCopy(kind), messageKindCopy(kind));
    assert.equal(fn.messageDisclaimerText(kind), messageDisclaimerText(kind));
  }
});
