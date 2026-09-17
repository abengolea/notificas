# Asistente IA nativo del CRM

El CRM es la fuente de verdad. El modelo no es una base de datos.

Hay **dos consumidores** de la misma capa de tools/services:

| Canal | Transporte | Permisos |
| --- | --- | --- |
| ChatGPT | MCP `POST /mcp/crm` | Solo lectura |
| Notificas | Gemini (Google GenAI) + function calling | Lectura + escrituras seguras |

Ninguno habla con Firestore. El asistente interno **no** llama al MCP para usar el CRM.

```
ChatGPT  → MCP adapters      ↘
                                CRM tool handlers → CRM domain services → repositories
Notificas → Gemini adapters  ↗
```

## Arquitectura

1. `src/lib/marketing/tools/` — definiciones, Zod, handlers.
2. `src/lib/marketing/ai/` — adapter Gemini, instrucciones, loop, auditoría, conversaciones.
3. `POST /api/admin/marketing/ai/chat` — endpoint admin (cookie HMAC existente).
4. UI: `/admin/marketing/asistente`.

`workspaceId` lo fija `getMarketingWorkspaceId()` (`MARKETING_WORKSPACE_ID` / `notificas-internal`). El cliente y el modelo no eligen workspace.

Contexto de una acción:

```
usuario (admin email) pidió
  → IA interpretó (actorType=ai, actorId=ai:<email>)
    → companyService / contactService / …
```

## Gemini

- SDK oficial `@google/genai`, solo servidor.
- `GEMINI_API_KEY` o `GOOGLE_GENAI_API_KEY` (nunca `NEXT_PUBLIC_*`).
- Modelo: `GEMINI_CRM_MODEL` (default `gemini-2.0-flash`). `GEMINI_CRM_MODEL_FAST` queda reservado; no hay routing avanzado todavía.
- Hasta 8 rondas de function calling.
- Ventana de conversación: últimos 12 mensajes user/assistant. La verdad mutable se vuelve a consultar con tools.
- Esta versión responde completa (sin streaming). Streaming queda como mejora.

## Tools

Lectura (mismas que MCP): `search_companies`, `get_company`, `search_contacts`, `get_contact`, `search_campaigns`, `get_campaign`, `search_lists`, `get_list`, `search_templates`, `get_template`, `get_company_activity`, `get_contact_activity`, `get_pending_tasks`, `get_crm_stats`.

Escritura segura: `create_company`, `update_company`, `create_contact`, `update_contact`, `create_task`, `complete_task`, `create_list`, `add_contact_to_list`, `create_note`, `create_opportunity`, `update_opportunity`, `create_campaign_draft`.

No existen: `send_campaign`, `send_email`, `delete_*`, bulk delete, merge automático.

Campañas y listas v1 se leen/escriben vía un catálogo (`CampaignListCatalog`) que envuelve los módulos actuales. Los handlers no importan Firebase.

## Writes

- `create_company` siempre devuelve `duplicateWarnings`. La IA no puede ocultarlos ni fusionar.
- Contacto/tarea/oportunidad por nombre de empresa: si hay una sola coincidencia, sigue; si hay varias, `needsClarification` y no escribe.
- Updates con whitelist Zod (`.strict()`).
- Notas = `activityService` `type=note_added`.
- Draft de campaña: status `draft`. Nunca envía.
- Bulk de 500 altas: no implementado. Un `add_contact_to_list` agrega un contacto.

## Seguridad

- Auth = sesión admin existente. Sin auth paralela.
- Autorización debajo del modelo: handlers + services + workspace fijo.
- Argumentos validados con Zod. Errores de dominio → `entity_not_found` / `validation_error`, sin stack traces.
- Rate limit ~20 req/min por admin.
- Si falta `GEMINI_API_KEY` o `CRM_AI` está off, el resto del CRM sigue; la UI muestra «Asistente IA no configurado».

## Auditoría e idempotencia

Colección `marketing_ai_audit_logs`: workspace, userId, conversationId, tool, entityIds, success, timestamp, usage opcional. Sin API keys ni chain-of-thought.

Creates usan `idempotencyKey` (id del function call de Gemini) en `marketing_ai_idempotency`. Un retry del modelo no duplica empresa/contacto/tarea/oportunidad.

Conversaciones: `marketing_ai_conversations` + `marketing_ai_messages` (texto user/assistant y nombres de tools; no se guardan dumps enormes de tools).

## Costos

Cada respuesta registra `model`, `inputTokens`, `outputTokens`, `totalTokens` cuando el SDK los devuelve. No hay billing interno.

## UI

`/admin/marketing/asistente`: historial, input, enviar, «Consultando CRM…», resumen de acciones (no JSON crudo).

## Configuración

```
CRM_AI=true
GEMINI_API_KEY=
GEMINI_CRM_MODEL=gemini-2.0-flash
MARKETING_WORKSPACE_ID=notificas-internal
```

## Fuera de esta etapa

Envío de campañas, mail, delete masivo, auto-merge, prospecting autónomo, `research_web`, agents en background.

`research_web` podrá agregarse después, separada de las CRM tools, sin mezclar «lo encontré en Internet» con «está en el CRM». Fuente futura: `type=ai_research`.
