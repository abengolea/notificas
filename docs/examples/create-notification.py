"""Ejemplo Python — send_certified_notification contra la API v1."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

API_URL = os.environ.get("NOTIFICAS_API_URL", "https://notificas.com.ar").rstrip("/")
API_KEY = os.environ.get("NOTIFICAS_API_KEY")


def send_certified_notification(
    *,
    channel: str,
    recipient: dict,
    template: str | None = None,
    variables: dict | None = None,
    reference: str | None = None,
    metadata: dict | None = None,
    idempotency_key: str,
) -> dict:
    if not API_KEY:
        raise SystemExit("Definí NOTIFICAS_API_KEY")
    payload = {
        "channel": channel,
        "recipient": recipient,
        "template": template,
        "variables": variables or {},
        "reference": reference,
        "metadata": metadata or {},
    }
    data = json.dumps({k: v for k, v in payload.items() if v is not None}).encode("utf-8")
    req = urllib.request.Request(
        f"{API_URL}/api/v1/notifications",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
            "Idempotency-Key": idempotency_key,
        },
    )
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        raise RuntimeError(body) from exc


if __name__ == "__main__":
    print(
        json.dumps(
            send_certified_notification(
                channel="whatsapp",
                recipient={
                    "name": "Juan Pérez",
                    "phone": "+5493364123456",
                    "email": "juan@email.com",
                    "document": "20123456789",
                },
                template="notificacion_deuda_180_dias",
                variables={
                    "nombre": "Juan Pérez",
                    "dni": "20123456",
                    "fecha": "27/08/2026",
                    "monto": "125000",
                    "cuotas": "4",
                },
                reference="CLIENTE-12345",
                metadata={"crm_id": "78482", "account_id": "ABC123"},
                idempotency_key="cliente-123-20260827",
            ),
            indent=2,
            ensure_ascii=False,
        )
    )
