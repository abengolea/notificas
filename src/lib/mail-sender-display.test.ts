import { test } from "node:test";
import assert from "node:assert/strict";
import { displayMailSender, isPlatformTransportEmail } from "./mail-sender-display";

test("las casillas SMTP de la plataforma no son el remitente", () => {
  assert.equal(isPlatformTransportEmail("contacto@notificas.com"), true);
  assert.equal(isPlatformTransportEmail("notificaciones@notificas.com.ar"), true);
  assert.equal(isPlatformTransportEmail("noreply@notificas.com.ar"), true);
  assert.equal(isPlatformTransportEmail("abengolea1@gmail.com"), false);
});

test("una cuenta de usuario @notificas.com sí se muestra", () => {
  assert.equal(
    displayMailSender({
      from: "contacto@notificas.com",
      senderName: "adrianbengolea@notificas.com",
    }),
    "adrianbengolea@notificas.com",
  );
});

test("la bandeja muestra el mail del usuario, no el From SMTP", () => {
  assert.equal(
    displayMailSender({
      from: "contacto@notificas.com",
      senderName: "abengolea1@gmail.com",
      replyTo: "abengolea1@gmail.com",
    }),
    "abengolea1@gmail.com",
  );
  assert.equal(
    displayMailSender({
      from: "Notificas <notificaciones@notificas.com.ar>",
      senderName: "estudio@ejemplo.com",
    }),
    "estudio@ejemplo.com",
  );
});

test("si senderName es un nombre, usa replyTo", () => {
  assert.equal(
    displayMailSender({
      from: "contacto@notificas.com",
      senderName: "Juan Pérez",
      replyTo: "juan@estudio.com",
    }),
    "juan@estudio.com",
  );
});

test("sin mail de usuario no inventa el de Notificas", () => {
  assert.equal(
    displayMailSender({
      from: "contacto@notificas.com",
      senderName: "Notificas",
    }),
    "—",
  );
  assert.equal(
    displayMailSender({
      from: "contacto@notificas.com",
      senderName: "contacto@notificas.com",
      replyTo: "contacto@notificas.com",
    }),
    "—",
  );
});
