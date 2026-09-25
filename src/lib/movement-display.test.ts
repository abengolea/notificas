import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MOVEMENT_TYPE_LABELS,
  inferClickSourceFromMovements,
  movementChannel,
  movementChannelLabel,
  publicMovementBrowserLabel,
  publicMovementDescription,
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
  assert.equal(readerOpenLabel("correo"), "NOTIFICACIÓN ABIERTA (DESDE CORREO)");
  assert.match(readerOpenDescription("correo"), /correo/i);
});

test("reader_magic_open detecta click previo de WhatsApp", () => {
  const movements = [
    { type: "whatsapp_link_clicked", timestamp: "2026-09-25T15:10:00.000Z" },
    { type: "reader_magic_open", timestamp: "2026-09-25T15:10:04.000Z", source: "reader_whatsapp" },
  ];
  assert.equal(inferClickSourceFromMovements(movements[1], movements), "whatsapp");
  assert.equal(readerOpenLabel("whatsapp"), "NOTIFICACIÓN ABIERTA (DESDE WHATSAPP)");
});
