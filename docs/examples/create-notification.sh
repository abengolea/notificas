#!/usr/bin/env bash
# Ejemplo cURL — crear una notificación certificada (WhatsApp).
# Reemplazá la API Key y, si corresponde, el template guardado en la organización.

curl -X POST https://notificas.com.ar/api/v1/notifications \
  -H "Authorization: Bearer ntf_live_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: cliente-123-20260827" \
  -H "X-Request-Id: req_client_123" \
  -d '{
    "channel": "whatsapp",
    "recipient": {
      "name": "Juan Pérez",
      "phone": "+5493364123456",
      "email": "juan@email.com",
      "document": "20123456789"
    },
    "template": "notificacion_deuda_180_dias",
    "variables": {
      "nombre": "Juan Pérez",
      "dni": "20123456",
      "fecha": "27/08/2026",
      "monto": "125000",
      "cuotas": "4"
    },
    "reference": "CLIENTE-12345",
    "metadata": {
      "crm_id": "78482",
      "account_id": "ABC123"
    }
  }'
