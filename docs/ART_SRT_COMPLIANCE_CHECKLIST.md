# Checklist técnico ART / notificación electrónica

Lista de controles de implementación. **No es una afirmación jurídica de cumplimiento** de la Resolución SRT 82/2020 ni de autorización de Notificas ante la SRT.

## Adhesión y persona

- [ ] Adhesión voluntaria (no alcanza con tener el teléfono)
- [ ] Acción positiva: checkbox + botón “ACEPTAR Y ADHERIRME”
- [ ] Identificación del trabajador (DNI, CUIL, nombre) por ART + trabajador (no global)
- [ ] Validación de contacto (OTP; canal actual: email)
- [ ] Identidad configurable (prevalidada ART ahora; RENAPER/Didit pendientes)
- [ ] Revocación posterior con confirmación
- [ ] Historial al cambiar teléfono o email (no overwrite silencioso)
- [ ] Revalidación configurable tras cambio de contacto

## Integridad y evidencia

- [ ] Términos versionados; el consentimiento apunta a una versión y su hash
- [ ] El texto aceptado no se modifica en silencio
- [ ] Evento de auditoría inmutable (`previousHash` / `eventHash`)
- [ ] Anclaje on-chain de hechos relevantes (si hay claves Polygon)
- [ ] Constancia PDF + JSON técnico
- [ ] QR / URL de verificación reutilizando `/verify`
- [ ] Copia WORM del JSON de adhesión
- [ ] La evidencia histórica no se borra al revocar
- [ ] Conservación configurada actualmente: 5 años (metadata/UI via `EVIDENCE_RETENTION_YEARS=5`). El lock WORM del bucket no se modifica. No afirmar cumplimiento normativo universal.

## Envío y fallback

- [ ] Gate `notification_type=SRT_ART` antes de enviar
- [ ] Revocado / suspendido / sin adhesión → `conventionalChannelRequired`
- [ ] Las notificaciones ordinarias no se bloquean
- [ ] No se afirma “autorizado por SRT” en UI ni constancias

## API, operación y seguridad

- [ ] API empresarial versionada (`/api/v1/art/*`)
- [ ] Webhooks `art.*` firmados
- [ ] Alta masiva CSV/XLSX asíncrona (Cloud Tasks)
- [ ] Aislamiento multiempresa
- [ ] Tokens públicos largos, aleatorios y expirables
- [ ] Rate limiting en flujo público
- [ ] OTP con vencimiento y tope de intentos
- [ ] Sin biometría almacenada
- [ ] Secretos solo en variables de entorno
- [ ] Feature flag `ART_MODULE_ENABLED` (producción intacta si está off)
- [ ] Fail-closed: `ART_GENERAL_RELEASE_ENABLED` default false; `MODULE=true` + `PILOT=false` no abre a todos
- [ ] Piloto: `ART_PILOT_MODE` + `ART_ALLOWED_ORGS` (otras orgs = 403)
- [ ] Allowlists de email/teléfono en piloto; fuera de lista = no envía
- [ ] Índices Firestore documentados
- [ ] Backups del proyecto Firebase (proceso operativo existente)
- [ ] Acceso de auditoría: eventos en `art_audit_events` + evidencias
- [ ] Panel ART: estados, reenviar invitación, evidencia, suspender con motivo

## Pendiente explícito

- [ ] Proveedor RENAPER
- [ ] Proveedor Didit / liveness
- [ ] OTP WhatsApp (template AUTH de Meta)
- [ ] OTP SMS
- [ ] Términos legales definitivos (hoy: términos de prueba interna en piloto)
- [ ] Presentación de la implementación ante SRT (fuera de este software)
- [ ] No afirmar “autorizado / aprobado / cumple SRT” ni “notificación legal válida”
