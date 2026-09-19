# MCP CRM (ChatGPT Work)

Endpoint interno de **CRM comercial**, separado del MCP de **producto certificado**.

| | Producto certificado | CRM interno |
| --- | --- | --- |
| URL | `POST /mcp` | `POST /mcp/crm` |
| Flag | `MCP_ENABLED` | `CRM_MCP` |
| Recurso OAuth | `{base}/mcp` | `{base}/mcp/crm` |
| Scopes | `account:read`, `notifications:*`, `campaigns:*`, … | `crm:read`, `crm:write`, `campaigns:read`, `campaigns:write` |
| Tools | envío certificado, certificados | CRM interno + borradores de campañas comerciales |
| Tenant | `orgId` de cliente | `workspaceId` de config (`notificas-internal`) |
| Auditoría | `mcp_audit_logs` | `marketing_mcp_audit` |

Una credencial de cliente del producto **no** entra al CRM: el token de `/mcp` tiene `resource` distinto y se rechaza en `/mcp/crm`. El registry de tools no se comparte.

El MCP CRM **no** llama a Firestore. Usa los mismos handlers que el asistente interno.

**No hay envío de email** desde este servidor: `send_campaign`, `retry_failed_sends`, `cancel_campaign` y `schedule_campaign` no están registrados.

## Endpoint

- JSON-RPC Streamable HTTP: `POST /mcp/crm`
- Salud: `GET /mcp/crm/health` → `{ ok, service, readOnly, sendForbidden, enabled }` (sin secretos)
- Metadata: `GET /.well-known/oauth-protected-resource/mcp/crm`
- Authorization Server path-aware (ChatGPT DCR): `GET /.well-known/oauth-authorization-server/mcp/crm` — mismo issuer y `registration_endpoint` que `/.well-known/oauth-authorization-server`
- Token client-credentials (opcional): `POST /mcp/crm/oauth/token` — **solo `crm:read`**

Workspace: siempre `getMarketingWorkspaceId()`. El modelo no puede mandar `workspaceId`.

## Auth

1. Token OAuth cuyo `resource` sea exactamente `{base}/mcp/crm` y al menos un scope CRM. Es el mecanismo para ChatGPT.
2. Bearer `CRM_MCP_TOKEN` (timing-safe), opcional para diagnóstico: **siempre `crm:read`**, nunca write.
3. Rechazo: API keys `ntf_live_` / `ntf_test_`, tokens del MCP de producto, tokens de otro resource.

Un scope **omitido o vacío** cae a `crm:read`. Un scope **explícito desconocido** (o una mezcla con uno desconocido) responde `invalid_scope` en authorize/consent y en `/oauth/token` si se envía `scope` contra el resource CRM. Nunca se reescribe un token inventado a `crm:read`.

Los tokens ya emitidos con solo `crm:read` siguen pudiendo **ejecutar** lecturas. `tools/list` anónimo publica las 35 tools de Fase A con `securitySchemes`; ChatGPT pide OAuth al llamar una tool.

`POST /mcp/crm` permite sin Bearer: `initialize`, `notifications/initialized`, `ping` y `tools/list` (solo el menú: nombre, descripción, schema, annotations, securitySchemes). **No** lee ni escribe CRM. `tools/call` exige OAuth: Bearer, resource `{base}/mcp/crm`, allowlist `CRM_MCP_ALLOWED_USERS` y el scope de esa tool. Si falta token o scope, responde JSON-RPC 200 `isError` con `_meta["mcp/www_authenticate"]` (no corta el transporte con HTTP 401).

## Tools

Lectura (`crm:read`, y campañas también con `campaigns:read`):

`search_companies`, `get_company`, `search_contacts`, `get_contact`, `search_campaigns`, `get_campaign`, `preview_campaign`, `search_lists`, `get_list`, `search_templates`, `get_template`, `get_company_activity`, `get_contact_activity`, `get_pending_tasks`, `get_crm_stats`, `list_taxonomy`, `search_opportunities`, `get_opportunity`.

Escritura CRM (`crm:write`):

`create_company`, `update_company`, `create_contact`, `update_contact`, `create_task`, `complete_task`, `cancel_task`, `create_note`, `create_opportunity`, `update_opportunity`, `create_list`, `add_contact_to_list`.

Escritura campañas (`campaigns:write`):

`create_campaign_draft`, `update_campaign_draft` (solo `status=draft`), `copy_campaign`, `archive_campaign`, `restore_campaign`.

`pause_campaign`, `resume_campaign`, `send_campaign`, `retry_failed_sends` y `cancel_campaign` quedan para Fase B con scope `campaigns:send` y **no están publicadas**.

Empresas: `create_company` / `update_company` usan `industryIds` (array), igual que el servicio de dominio. `search_companies` y segmentos de campaña usan `industryId` (singular).

`create_campaign_draft` no acepta `send`, `status` ni programación. `tools/list` anónimo muestra las 35 tools de Fase A; la autorización se aplica en `tools/call` según el scope del token.

Paginación: default 20, máximo 100, cursor opaco. `get_*` recorta listas relacionadas (~8 ítems). No hay `execute_crm_query`.

No se devuelven secrets, API keys, tokens OAuth, credenciales Gmail ni datos del producto certificado.

## Auditoría

`marketing_mcp_audit`: actor, tool, workspace, timestamp, success/failure, duration. Sin prompt completo ni secretos.

Rate limit: cubeta `crmws:{workspaceId}`. Lecturas `read`, escrituras `write`.

Idempotencia: header `Idempotency-Key` o campo `idempotencyKey` en create/copy.

## Cómo conectar ChatGPT

1. `CRM_MCP=true`
2. `CRM_MCP_ALLOWED_USERS` con los correos o UID autorizados
3. `MCP_BASE_URL` / `NEXT_PUBLIC_APP_URL` público HTTPS
4. En ChatGPT Business, modo desarrollador / complemento MCP:
   - Server URL: `https://<host>/mcp/crm`
   - Auth: OAuth 2.1 con PKCE mediante la metadata publicada
5. Tras un deploy con scopes nuevos, **reconectar** el conector para consentir `crm:write` / `campaigns:write`.

## Configuración

```
CRM_MCP=true
CRM_MCP_TOKEN=              # diagnóstico, solo lectura
CRM_MCP_CLIENT_ID=          # opcional
CRM_MCP_CLIENT_SECRET=      # opcional; client-credentials también es solo crm:read
CRM_MCP_ALLOWED_USERS=
MARKETING_WORKSPACE_ID=notificas-internal
MCP_BASE_URL=https://notificas.com.ar
```

No comparte `MCP_ENABLED` ni la allowlist de usuarios del producto. No hay variables nuevas para la Fase A.

## Testing

`src/mcp/crm/crm.test.ts` y `src/lib/marketing/tools/tools.test.ts`.
