# 🚀 Implementación del Sistema de Tracking con HMAC

## 📋 **Resumen de Cambios Implementados**

### ✅ **FASE 1 COMPLETADA:**
1. **Reemplazo del pixel por header visible** - Tracking sin elementos "sospechosos"
2. **Sistema HMAC** - Validación criptográfica de tokens
3. **Botones de acuse/rechazo** - Flujo legal completo
4. **Funciones de Firebase** - Endpoints seguros para tracking
5. **Template de email actualizado** - Diseño profesional y funcional

---

## 🔧 **Configuración Requerida**

### **1. Generar Secreto HMAC**
```bash
cd functions
node ../scripts/generate-hmac-secret.js
```

### **2. Configurar Variables de Entorno**
```bash
# En functions/.env
TRACKING_HMAC_SECRET=tu_secreto_generado_aqui

# En Firebase Functions
firebase functions:config:set tracking.hmac_secret="tu_secreto_generado_aqui"
```

### **3. Deploy de Functions**
```bash
firebase deploy --only functions
```

---

## 🎯 **Nuevas Funcionalidades**

### **Header Visible para Tracking**
- **Reemplaza** el pixel 1x1 por una imagen SVG profesional
- **Registra apertura** automáticamente cuando se carga el email
- **Diseño consistente** con la marca Notificas

### **Botones de Acuse/Rechazo**
- **📩 Acuso recibo (sin conformidad)** - Registra acceso técnico
- **❌ Rechazo** - Marca mensaje como rechazado
- **Leyenda legal clara** - Explica qué significa cada acción

### **Sistema HMAC**
- **Tokens criptográficos** en lugar de strings aleatorios
- **Validación estricta** en todos los endpoints
- **Seguridad mejorada** contra ataques

---

## 📧 **Template de Email Actualizado**

### **Antes (Pixel 1x1):**
```html
<img src="pixel.gif" width="1" height="1" />
```

### **Ahora (Header Visible):**
```html
<img src="/trackHeader?msg=ID&k=HMAC" 
     alt="Notificación Oficial" 
     style="width: 100%; max-width: 600px; height: auto;" />
```

### **Botones de Acción:**
```html
<a href="/confirmRead?msg=ID&k=HMAC">📩 Acuso recibo (sin conformidad)</a>
<a href="/reject?msg=ID&k=HMAC">❌ Rechazo</a>
```

---

## 🔐 **Endpoints de Firebase Functions**

### **1. trackHeader** - Tracking de apertura
```
GET /trackHeader?msg={docId}&k={hmac}
```
- **Función**: Registra apertura del email
- **Retorna**: Imagen SVG del header
- **Seguridad**: Validación HMAC

### **2. confirmRead** - Acuse de recibo
```
GET /confirmRead?msg={docId}&k={hmac}
```
- **Función**: Confirma lectura del mensaje
- **Retorna**: Página HTML de confirmación
- **Seguridad**: Validación HMAC + leyenda legal

### **3. reject** - Rechazo de mensaje
```
GET /reject?msg={docId}&k={hmac}
```
- **Función**: Marca mensaje como rechazado
- **Retorna**: Página HTML de rechazo
- **Seguridad**: Validación HMAC + leyenda legal

---

## 📊 **Estructura de Datos en Firestore**

### **Tracking Mejorado:**
```javascript
tracking: {
  token: "token_original",
  opened: true,
  openedAt: "2024-01-01T00:00:00Z",
  openCount: 1,
  lastOpenAt: "2024-01-01T00:00:00Z",
  lastOpenUa: "User-Agent",
  lastOpenIp: "IP_Address",
  readConfirmed: true,
  readConfirmedAt: "2024-01-01T00:00:00Z",
  rejected: false,
  rejectedAt: null
}
```

---

## 🚀 **Próximos Pasos (FASE 2)**

### **1. Endurecer Reader**
- Validación HMAC en la página del reader
- Bloqueo de acceso sin token válido

### **2. PDF de Constancia con Datos Reales**
- Incluir métricas de tracking reales
- Enlaces a archivos adjuntos
- Hash del mensaje original

### **3. Certificación Blockchain**
- Conectar con funciones de Polygon
- Guardar hashes de transacciones

---

## ⚠️ **Consideraciones de Seguridad**

### **HMAC Secret:**
- **Mínimo 32 bytes** (256 bits)
- **Secreto y privado** - no compartir
- **Rotación periódica** recomendada

### **Rate Limiting:**
- Implementar límites por IP
- Prevenir spam de tracking

### **Validación de Tokens:**
- **Siempre validar HMAC** antes de procesar
- **Logs de seguridad** para tokens inválidos

---

## 🔍 **Testing**

### **1. Generar Email de Prueba**
```bash
# Enviar mensaje desde dashboard
# Verificar que se genere HMAC correcto
```

### **2. Probar Endpoints**
```bash
# Verificar trackHeader devuelve SVG
# Confirmar lectura funciona
# Probar rechazo de mensaje
```

### **3. Verificar Tracking**
```bash
# Revisar logs de Firebase Functions
# Verificar datos en Firestore
```

---

## 📞 **Soporte**

Si encuentras problemas:
1. **Revisar logs** de Firebase Functions
2. **Verificar variables** de entorno
3. **Confirmar HMAC** está configurado
4. **Revisar permisos** de Firestore

---

## 🎉 **¡Implementación Completada!**

El sistema ahora tiene:
- ✅ **Tracking profesional** sin elementos sospechosos
- ✅ **Seguridad HMAC** robusta
- ✅ **Flujo legal completo** con acuse/rechazo
- ✅ **Endpoints seguros** para todas las acciones
- ✅ **Template de email** moderno y funcional

¡Tu sistema de notificaciones ahora es más profesional, seguro y legalmente sólido!
