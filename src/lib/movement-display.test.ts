import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MOVEMENT_TYPE_LABELS,
  inferClickSourceFromMovements,
  linkClickOriginLabel,
  movementChannel,
  movementChannelLabel,
  publicLinkClickDescription,
  publicMovementBrowserLabel,
  publicMovementDescription,
  attachmentOpenDescription,
  attachmentOpenLabel,
  attachmentOpenStoredSource,
  readerOpenAlreadyLogged,
  readerOpenDescription,
  readerOpenLabel,
} from "./movement-display";

test("el canal se lee de un vistazo: correo, WhatsApp o página", () => {
  assert.equal(movementChannelLabel(movementChannel("resend_sent")), "Correo");
  assert.equal(movementChannelLabel(movementChannel("email_sent")), "Correo");
  assert.equal(movementChannelLabel(movementChannel("whatsapp_read")), "WhatsApp");
  assert.equal(movementChannelLabel(movementChannel("read_confirmed")), "Página web");
});

test("los títulos de correo no nombran al proveedor", () => {
  assert.equal(MOVEMENT_TYPE_LABELS.resend_sent, "CORREO ACEPTADO PARA ENTREGA");
  assert.match(MOVEMENT_TYPE_LABELS.resend_delivered, /CORREO/);
  assert.doesNotMatch(Object.values(MOVEMENT_TYPE_LABELS).join(" "), /resend/i);
});

test("las descripciones viejas de Resend se leen en criollo", () => {
  assert.equal(
    publicMovementDescription("Resend aceptó el mensaje para entrega."),
    "El servicio de correo aceptó el mensaje para enviarlo.",
  );
  assert.match(
    publicMovementDescription("Resend informó que el servidor de correo del destinatario aceptó el mensaje."),
    /servidor de correo/i,
  );
  assert.doesNotMatch(publicMovementDescription("Resend informó fallo de envío."), /resend/i);
});

test("el navegador no muestra Resend ni Meta", () => {
  assert.equal(publicMovementBrowserLabel("Resend"), "Servicio de correo");
  assert.equal(publicMovementBrowserLabel("Sistema (WhatsApp de Meta)"), "WhatsApp");
});

test("reader_magic_open indica si el acceso vino por correo o WhatsApp", () => {
  const movements = [
    { type: "link_clicked", timestamp: "2026-09-25T15:10:00.000Z" },
    { type: "reader_magic_open", timestamp: "2026-09-25T15:10:05.000Z" },
  ];
  assert.equal(inferClickSourceFromMovements(movements[1], movements), "correo");
  assert.equal(readerOpenLabel("correo"), "NOTIFICACIÓN ABIERTA DESDE EL CORREO");
  assert.match(readerOpenDescription("correo"), /correo electrónico/i);
});

test("reader_magic_open detecta click previo de WhatsApp", () => {
  const movements = [
    { type: "whatsapp_link_clicked", timestamp: "2026-09-25T15:10:00.000Z" },
    { type: "reader_magic_open", timestamp: "2026-09-25T15:10:04.000Z", source: "reader_whatsapp" },
  ];
  assert.equal(inferClickSourceFromMovements(movements[1], movements), "whatsapp");
  assert.equal(readerOpenLabel("whatsapp"), "NOTIFICACIÓN ABIERTA DESDE WHATSAPP");
});

test("el clic del enlace dice si vino del WhatsApp o del correo", () => {
  assert.equal(MOVEMENT_TYPE_LABELS.link_clicked, "ENLACE PULSADO DESDE EL CORREO");
  assert.equal(MOVEMENT_TYPE_LABELS.whatsapp_link_clicked, "ENLACE PULSADO DESDE WHATSAPP");
  assert.equal(linkClickOriginLabel("whatsapp_link_clicked"), "mensaje de WhatsApp");
  assert.equal(linkClickOriginLabel("link_clicked"), "correo electrónico");
  assert.match(
    publicLinkClickDescription("whatsapp_link_clicked", "Pulsaron el enlace en WhatsApp para abrir la notificación"),
    /mensaje de WhatsApp/,
  );
  assert.match(
    publicLinkClickDescription("link_clicked", "Pulsaron el botón del correo para abrir la notificación"),
    /correo electrónico/,
  );
});

test('readerOpenAlreadyLogged: recargar por el mismo canal no suma; entrar por el otro canal sí', () => {
  const porWhatsapp = [{ type: 'reader_magic_open', clickSource: 'whatsapp', source: 'reader_whatsapp' }];
  assert.equal(readerOpenAlreadyLogged([], 'whatsapp'), false);
  assert.equal(readerOpenAlreadyLogged(porWhatsapp, 'whatsapp'), true);
  assert.equal(readerOpenAlreadyLogged(porWhatsapp, 'correo'), false);
  assert.equal(readerOpenAlreadyLogged([{ type: 'reader_magic_open', clickSource: 'correo', source: 'reader_email' }], 'whatsapp'), false);
});

test('readerOpenAlreadyLogged: sin canal conocido se mantiene una sola apertura', () => {
  const porWhatsapp = [{ type: 'reader_magic_open', clickSource: 'whatsapp', source: 'reader_whatsapp' }];
  assert.equal(readerOpenAlreadyLogged(porWhatsapp, 'unknown'), true);
  assert.equal(readerOpenAlreadyLogged([{ type: 'reader_magic_open' }], 'correo'), true);
  assert.equal(readerOpenAlreadyLogged([{ type: 'link_clicked' }, { type: 'app_opened' }], 'correo'), false);
});

test('adjunto abierto desde el lector: el movimiento guarda y muestra por qué canal entró', () => {
  assert.equal(attachmentOpenStoredSource('correo'), 'reader_email');
  assert.equal(attachmentOpenStoredSource('whatsapp'), 'reader_whatsapp');
  assert.equal(attachmentOpenStoredSource('unknown'), undefined);

  assert.match(attachmentOpenDescription('a.pdf', 'correo'), /^Apertura de archivo adjunto: a\.pdf\. .*correo electrónico\.$/);
  assert.match(attachmentOpenDescription('a.pdf', 'whatsapp'), /WhatsApp\.$/);
  assert.equal(attachmentOpenDescription('a.pdf', 'unknown'), 'Apertura de archivo adjunto: a.pdf');

  assert.equal(attachmentOpenLabel({ source: 'reader_email' }), 'ARCHIVO ABIERTO (LECTOR · CORREO)');
  assert.equal(attachmentOpenLabel({ source: 'reader_whatsapp' }), 'ARCHIVO ABIERTO (LECTOR · WHATSAPP)');
  // Adjuntos abiertos desde el enlace directo del correo viejo (linkRedirect).
  assert.equal(attachmentOpenLabel({ source: 'email' }), 'ARCHIVO ABIERTO DESDE EL CORREO');
  assert.equal(attachmentOpenLabel({ source: 'whatsapp' }), 'ARCHIVO ABIERTO DESDE WHATSAPP');
  // Movimientos viejos, sin canal: el título de siempre.
  assert.equal(attachmentOpenLabel({}), 'ARCHIVO ABIERTO (PÁGINA WEB)');
});
