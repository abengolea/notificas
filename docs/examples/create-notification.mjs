/**
 * Ejemplo Node.js — send_certified_notification contra la API v1.
 * Uso: NOTIFICAS_API_KEY=ntf_live_… node docs/examples/create-notification.mjs
 */

const API_URL = process.env.NOTIFICAS_API_URL || "https://notificas.com.ar";
const API_KEY = process.env.NOTIFICAS_API_KEY;

if (!API_KEY) {
  console.error("Definí NOTIFICAS_API_KEY");
  process.exit(1);
}

async function sendCertifiedNotification(input) {
  const res = await fetch(`${API_URL}/api/v1/notifications`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      channel: input.channel,
      recipient: input.recipient,
      template: input.template,
      variables: input.variables,
      reference: input.reference,
      metadata: input.metadata,
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message || `HTTP ${res.status}`);
  }
  return body;
}

const result = await sendCertifiedNotification({
  idempotencyKey: `cliente-123-20260827`,
  channel: "whatsapp",
  recipient: {
    name: "Juan Pérez",
    phone: "+5493364123456",
    email: "juan@email.com",
    document: "20123456789",
  },
  template: "notificacion_deuda_180_dias",
  variables: {
    nombre: "Juan Pérez",
    dni: "20123456",
    fecha: "27/08/2026",
    monto: "125000",
    cuotas: "4",
  },
  reference: "CLIENTE-12345",
  metadata: { crm_id: "78482", account_id: "ABC123" },
});

console.log(result);
