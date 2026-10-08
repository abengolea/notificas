import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeHtmlForReader } from "./sanitize-reader-html";

const envelope = `
<p class="lead">Estimado/a Adrian Bengolea,</p>
<p class="lead">
  Ha recibido una <strong>comunicacion fehaciente digital</strong> de <strong>abengolea@hotmail.com</strong>.
  Puede leer el texto en este mismo correo; para la <strong>constancia fehaciente de lectura</strong> en la plataforma, use el enlace siguiente.
</p>
<div class="message-content">
  <h2>Contenido del Mensaje:</h2>
  <p>PRUEBA 3</p>
</div>
<p style="margin: 20px 0;">
  <a class="btn" href="#">Acceder a la notificación</a>
</p>
<p class="muted">
  Si el boton no funciona, copie y pegue este enlace en su navegador:<br>
  <a href="#">[El enlace se agregará al enviar el mensaje]</a>
</p>
`;

test("el lector no muestra el sobre que pide usar el enlace o leer el correo", () => {
  const out = sanitizeHtmlForReader(envelope);
  assert.equal(/fehaciente/i.test(out), false);
  assert.equal(/Estimado\/a/.test(out), false);
  assert.equal(/use el enlace/i.test(out), false);
  assert.equal(/este mismo correo/i.test(out), false);
  assert.equal(/Acceder a la notificación/.test(out), false);
  assert.equal(/Si el boton no funciona/.test(out), false);
  assert.match(out, /PRUEBA 3/);
  assert.match(out, /Contenido del Mensaje/);
});

test("también saca el lead de campañas mixtas", () => {
  const html = `<p class="lead">Estimado/a Ana,</p>
<p class="lead">Recibió una comunicación de Colegio. El texto siguiente es el mismo mensaje enviado por WhatsApp. El enlace registra la apertura en Notificas.com.</p>
<div class="message-content">Carta.</div>`;
  const out = sanitizeHtmlForReader(html);
  assert.equal(/WhatsApp/.test(out), false);
  assert.equal(/Estimado\/a/.test(out), false);
  assert.match(out, /Carta/);
});

test("si el mail tenía globo de Meta y carta oculta, el lector muestra el globo", () => {
  const html = `
<!-- MAILBOX_META_START -->
<div class="message-content" data-reader-hide>
  <h2>Contenido del mensaje</h2>
  <div><p>El Colegio le envía una intimación oficial.</p></div>
</div>
<!-- MAILBOX_META_END -->
<div class="message-content" data-email-hide>
  <h2>Contenido del mensaje</h2>
  <div><p>PRUEBA NUEVA NUEVA</p></div>
</div>
<p class="lead">Estimado/a Ana,</p>
`;
  const out = sanitizeHtmlForReader(html);
  assert.match(out, /intimación oficial/);
  assert.equal(/PRUEBA NUEVA/.test(out), false);
  assert.equal(/Estimado\/a/.test(out), false);
  assert.equal(/data-reader-hide/.test(out), false);
});
