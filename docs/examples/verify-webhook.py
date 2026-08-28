"""Cómo verificar la firma de un webhook de Notificas (HMAC-SHA256)."""

import hashlib
import hmac
import json
import time


def verify_notificas_signature(
    *,
    secret: str,
    event_id: str,
    timestamp: str,
    raw_body: bytes,
    signature_header: str,
    max_skew_seconds: int = 300,
) -> bool:
    try:
        ts = int(timestamp)
    except ValueError:
        return False
    if abs(time.time() - ts) > max_skew_seconds:
        return False
    provided = signature_header.strip()
    if provided.startswith("v1="):
        provided = provided[3:]
    payload = f"{event_id}.{timestamp}.{raw_body.decode('utf-8')}".encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, provided.lower())


if __name__ == "__main__":
    body = json.dumps(
        {
            "id": "evt_01EXAMPLE",
            "type": "notification.delivered",
            "created_at": "2026-08-27T13:15:00Z",
            "data": {
                "notification_id": "ntf_01EXAMPLE",
                "reference": "CLIENTE-12345",
                "status": "delivered",
            },
        },
        separators=(",", ":"),
    ).encode("utf-8")
    print("Usá el raw body exacto (bytes) que recibió tu servidor, no un JSON re-serializado.")
