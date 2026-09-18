# MCP CRM read-only (ChatGPT)

Endpoint interno de **CRM comercial**, separado del MCP de **producto certificado**.

| | Producto certificado | CRM interno |
| --- | --- | --- |
| URL | `POST /mcp` | `POST /mcp/crm` |
| Flag | `MCP_ENABLED` | `CRM_MCP` |
| Recurso OAuth | `{base}/mcp` | `{base}/mcp/crm` |
| Scopes | `account:read`, `notifications:*`, `campaigns:*`, … | `crm:read` |
| Tools | envío certificado, certificados | solo lectura CRM |
| Tenant | `orgId` de cliente | `workspaceId` de config (`notificas-internal`) |
| Auditoría | `mcp_audit_logs` | `marketing_mcp_audit` |

Una credencial de cliente del producto **no** entra al CRM: el token de `/mcp` tiene `resource` distinto y se rechaza en `/mcp/crm`. El registry de tools no se comparte.

El MCP CRM **no** llama a Firestore. Usa los mismos handlers que el asistente interno, en modo `read`.

## Endpoint

- JSON-RPC Streamable HTTP: `POST /mcp/crm`
- Salud: `GET /mcp/crm/health` → `{ ok, service, readOnly, enabled }` (sin secretos)
- Metadata: `GET /.well-known/oauth-protected-resource/mcp/crm`
- Token client-credentials (opcional): `POST /mcp/crm/oauth/token`

Workspace: siempre `getMarketingWorkspaceId()`. El modelo no puede mandar `workspaceId`.

## Auth

1. Token OAuth cuyo `resource` sea exactamente `{base}/mcp/crm` y scope `crm:read`. Es el mecanismo para ChatGPT.
2. Bearer `CRM_MCP_TOKEN` (timing-safe), opcional para diagnóstico o clientes controlados.
3. Rechazo: API keys `ntf_live_` / `ntf_test_`, tokens del MCP de producto, tokens de otro resource.

Scopes CRM: solo `crm:read`. No hay `crm:write`.

## Tools (todas read-only)

`search_companies`, `get_company`, `search_contacts`, `get_contact`, `search_campaigns`, `get_campaign`, `search_lists`, `get_list`, `search_templates`, `get_template`, `get_company_activity`, `get_contact_activity`, `get_pending_tasks`, `get_crm_stats`.

Paginación: default 20, máximo 100, cursor opaco de los services. `get_*` recorta listas relacionadas (~8 ítems). No hay `execute_crm_query`.

No se devuelven secrets, API keys, tokens OAuth, credenciales Gmail ni datos del producto certificado.

## Garantía read-only

El registry MCP no registra tools de escritura. `create_*`, `update_*`, `send_*` responden `FEATURE_NOT_AVAILABLE` / `forbidden_tool`.

## Auditoría

`marketing_mcp_audit`: actor, tool, workspace, timestamp, success/failure, duration. Sin prompt completo ni secretos.

Rate limit: mismo mecanismo que el MCP de producto, cubeta `crmws:{workspaceId}` para no mezclar con `orgId` de clientes.

## Cómo conectar ChatGPT

1. `CRM_MCP=true`
2. `CRM_MCP_ALLOWED_USERS` con los correos o UID autorizados
3. `MCP_BASE_URL` / `NEXT_PUBLIC_APP_URL` público HTTPS
4. En ChatGPT Business, modo desarrollador / complemento MCP:
   - Server URL: `https://<host>/mcp/crm`
   - Auth: OAuth 2.1 con PKCE mediante la metadata publicada
5. Probar: «¿Cuántas empresas tenemos en el CRM?» (usa `get_crm_stats`) y «Mostrame las empresas de Argentina» (`search_companies`).

Opcional para diagnóstico o clientes controlados: `CRM_MCP_TOKEN`, o `CRM_MCP_CLIENT_ID` + `CRM_MCP_CLIENT_SECRET` contra `POST /mcp/crm/oauth/token`. ChatGPT usa el flujo OAuth 2.1 con PKCE publicado por el servidor.

## Configuración

```
CRM_MCP=true
CRM_MCP_TOKEN=
CRM_MCP_CLIENT_ID=          # opcional
CRM_MCP_CLIENT_SECRET=      # opcional
CRM_MCP_ALLOWED_USERS=      # opcional; vacío = el token estático alcanza
MARKETING_WORKSPACE_ID=notificas-internal
MCP_BASE_URL=https://notificas.com.ar
```

`CRM_MCP` default off. No comparte `MCP_ENABLED` ni la allowlist de usuarios del producto.

## Testing

`src/mcp/crm/crm.test.ts` y `src/lib/marketing/tools/tools.test.ts`: tools read-only, workspace fijo, paginación, sin writes, cruzado invisible.

## Preguntas típicas

- «¿Qué empresas tenemos en seguros de Uruguay?» → `search_companies` country + industry
- «¿A cuáles ya contactamos?» / «¿Quién respondió?» → compañías/contactos por `commercialStageId` o `get_crm_stats.responses`
- «¿Qué campañas hicimos en Chile?» → `search_campaigns`
- «¿Qué tenemos pendiente esta semana?» → `get_pending_tasks`
- «¿Qué contactos tenemos de Naturgy?» → `search_companies` + `search_contacts`
