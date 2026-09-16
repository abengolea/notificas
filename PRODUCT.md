# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Destinatarios de notificaciones certificadas:** personas y empresas que envían o reciben comunicaciones con constancia de envío, entrega y lectura en Notificas.
- **Empresas (B2B):** estudios, compañías y organizaciones que operan campañas, listas y créditos desde el panel de empresa.
- **Administrador de Notificas (Adrian):** opera el panel `/admin` — usuarios, empresas, campañas certificadas, planes, reclamos y, confirmado en esta sesión, el CRM de marketing comercial. No es el mismo flujo que las notificaciones fehacientes.

## Product Purpose

Notificas es un sistema de **comunicaciones certificadas** (correo y WhatsApp) con evidencia técnica y, cuando aplica, sello en blockchain. El producto existe para que un envío deje constancia verificable.

El **CRM de marketing** del admin es un espacio aparte: outreach comercial desde `contacto@notificas.com.ar` a empresas de distintos países, con listas, campañas, etapas y seguimiento de envío / apertura / clic / respuesta. No consume créditos de clientes y no genera constancia fehaciente.

Éxito del CRM: poder cargar contactos por país, enviar una campaña, y ver quién abrió, quién hizo clic y quién respondió, sin mezclarlo con las campañas certificadas.

## Positioning

Las campañas de producto certifican un acto de comunicación. El CRM de marketing vende o presenta Notificas a empresas que todavía no son clientas, agrupadas por país, con Gmail como bandeja de respuestas.

## Operating Context

- Panel admin existente (`/admin`), sesión por cookie HttpOnly.
- Envío masivo de marketing: **Resend**, remitente `Notificas <contacto@notificas.com.ar>`. Reply-To: `adrianbengolea@notificas.com`.
- Respuestas: **Gmail API** (OAuth, solo lectura) sobre la casilla `adrianbengolea@notificas.com`.
- Aperturas y clics: señal técnica (pixel / webhook Resend / redirección). No son lectura fehaciente.
- Importación CSV de contactos en **listas nominadas**. Países: LATAM hispana + Brasil + España.
- Firestore vía Admin SDK. El cliente web no escribe colecciones de marketing.

## Capabilities and Constraints

- Módulo admin `/admin/marketing`: resumen por país, contactos con listas, campañas, conexión Gmail.
- Etapas: nuevo → en cola / enviado → abierto → clic → respondió; más no interesa, rebotó, baja.
- Antes de enviar una campaña se carga el CSV de destinatarios y el texto del correo en la misma pantalla. No se arrastran contactos viejos del CRM.
- From fijo: `contacto@notificas.com.ar`. La API key de Resend de producción solo autoriza `@notificas.com.ar`, no `@notificas.com`. Reply-To y Gmail siguen en `adrianbengolea@notificas.com`.
- Gmail Workspace tiene tope diario propio; el envío masivo no pasa por Gmail para no quemar la casilla.
- OAuth de Gmail requiere `GOOGLE_MARKETING_OAUTH_CLIENT_ID` y `GOOGLE_MARKETING_OAUTH_CLIENT_SECRET` (y URI de redirección registrada). Sin eso, el CRM carga contactos y arma campañas, pero no sincroniza respuestas.
- Resend debe tener autorizado el From `@notificas.com.ar`.
- **Undecided:** volumen máximo por tanda y plantillas legales por país (solo aviso de baja genérico en v1).

## Brand Commitments

- Nombre: Notificas.
- Remitente de marketing: Notificas / `contacto@notificas.com.ar`.
- Español en el admin.
- No presentar aperturas de marketing como prueba fehaciente.

## Evidence on Hand

- Producto en producción: notificaciones certificadas, campañas de empresa, Resend, Meta/WhatsApp, panel admin.
- No hay listas de empresas prospecto en el repo; el usuario las carga.
- No fabricar testimonios, tasas de apertura ni clientes en copy de campaña.

## Product Principles

1. Certificado y comercial no se mezclan: colecciones, UI y lenguaje distintos.
2. El seguimiento se lee por país; el país es el eje, no un filtro secundario.
3. La bandeja de Adrian es la fuente de las respuestas; Resend es el tubo de salida.
4. Una apertura es una señal técnica, nunca una lectura certificada.
5. El admin hereda el sistema visual actual: tarea primero, misma familia de componentes.
