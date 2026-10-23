# Widget de Notificas dentro de gestión-regatas

Este agente no puede pushear al repo `abengolea/gestion-regatas` (403). Aplicá el cambio en tu máquina, en `C:\DEV\gestion-regatas`.

## Aplicar el parche

```bat
cd C:\DEV\gestion-regatas
git apply C:\DEV\notificas\docs\examples\gestion-regatas-embed\apply-in-gestion-regatas.patch
```

Si el path de Notificas es otro, apuntá el `.patch` a esta carpeta.

## Probar un envío real

1. En Notificas (`C:\DEV\notificas`) generá una API key: `/admin/api-keys` o  
   `npx tsx scripts/create-api-key.ts --orgId ORG_ID --name "Regatas prueba" --env test`
2. En `C:\DEV\gestion-regatas\.env.local`:

```
NOTIFICAS_API_KEY=ntf_test_xxxxxxxx
NOTIFICAS_API_BASE=http://localhost:9006/api/v1
```

Si Notificas ya está en producción con la API v1:

```
NOTIFICAS_API_BASE=https://notificas.com.ar/api/v1
```

3. Levantá los dos proyectos:

```
C:\DEV\notificas     → npm run dev     (puerto 9006)
C:\DEV\gestion-regatas → npm run dev   (puerto 9003)
```

4. Entrá a Regatas+ como super admin → **Configuración global** → **Probar Notificas (widget)**  
   URL: http://localhost:9003/dashboard/admin/notificas

La clave `ntf_live_` / `ntf_test_` **no** va en el HTML. El widget llama a `/api/notificas` en Regatas; el servidor reenvía a Notificas.

Si falta `NOTIFICAS_API_KEY`, la ventana igual aparece en modo demo (no envía).

## Archivos que agrega el parche

- `public/sdk/v1/notificas.js`
- `src/lib/notificas-embed.ts`
- `src/app/api/notificas/session/route.ts`
- `src/app/api/notificas/[...path]/route.ts`
- `src/app/dashboard/admin/notificas/page.tsx`
- link en Configuración global + vars en `.env.example`
