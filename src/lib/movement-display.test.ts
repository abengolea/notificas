import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MOVEMENT_TYPE_LABELS,
  movementChannel,
  movementChannelLabel,
  publicMovementBrowserLabel,
  publicMovementDescription,
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
