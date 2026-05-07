# Auditoría Gráfica del Certificado PDF - Notificas

**Fecha:** 18 de marzo de 2026  
**Referencia:** `certificado-lectura-V8c4k6Ra9WIoMLh5mycy.pdf`

---

## Veredicto General

**¿Aspecto profesional?** Parcialmente. El certificado cumple su función legal pero la parte gráfica tiene margen claro de mejora. Comparado con documentos de entidades como AFIP, bancos o estudios jurídicos, transmite menos autoridad y pulido.

**Puntuación gráfica:** 5/10

---

## Hallazgos Críticos (Contenido)

### 1. Contenido del mensaje incorrecto
**Severidad: Crítica**

La sección "Contenido del mensaje certificado" muestra el **template completo del email** (badge NOTIFICACIÓN, "Estimado/a…", "Ha recibido una comunicación fehaciente…", "Acceder a la notificación", disclaimer legal, etc.) en lugar del **mensaje real del usuario** ("hola prueba de adrian msj").

**Impacto:** El certificado no refleja de forma clara el contenido notificado, dificulta la lectura y resta credibilidad.

**Causa:** Se usa `message.html` (email completo) en lugar de `message.content` (texto real).

**Solución:** Priorizar `message.content`; si no existe, extraer solo el bloque de contenido del HTML.

---

## Hallazgos Gráficos

### 2. Ausencia de logo de marca
**Severidad: Alta**

El encabezado solo muestra "NOTIFICAS.COM" en texto. Documentos institucionales suelen incluir logo (AFIP, bancos, estudios).

**Solución:** Incorporar `notificasLogo.jpg` en el header.

### 3. Tipografía genérica
**Severidad: Alta**

- Solo Helvetica (y Courier para técnico)
- Todo en MAYÚSCULAS en títulos genera sensación de "grito"
- Sin variación real de fuentes (Times para títulos legales sería más apropiado)

**Solución:** Usar Times para títulos principales; Helvetica para cuerpo; evitar mayúsculas absolutas; usar Title Case.

### 4. Jerarquía visual plana
**Severidad: Media**

- Títulos de sección muy parecidos
- Poca diferencia entre secciones principales y secundarias
- Espaciado uniforme sin ritmo

**Solución:** Diferenciar niveles (tamaño, peso, color); aumentar espacios entre secciones clave.

### 5. Tabla bitácora apretada
**Severidad: Media**

- "Apertura en app web" se parte en dos líneas en columna "Evento"
- Columnas posiblemente demasiado estrechas
- Header de tabla poco distinguible

**Solución:** Revisar proporciones de columnas; aumentar espacio para "Evento"; reforzar estilo del header.

### 6. Cadena de integridad: corte de palabras
**Severidad: Media**

- El hash se parte en `goyitobengolea@gmail.co` + `m`
- Cortes en medio de direcciones de email reducen legibilidad

**Solución:** Permitir `splitTextToSize` con ancho menor o forzar saltos en caracteres seguros (ej. después de `@` o `-`).

### 7. Contraste en impresión B&N
**Severidad: Baja**

- Grises suaves pueden verse muy claros en B&N
- Bordes finos pueden perderse

**Solución:** Oscurecer ligeramente bordes y grises para impresión.

### 8. Footer muy largo
**Severidad: Baja**

- Una sola línea muy larga puede hacer wrap de forma poco controlada

**Solución:** Permitir multilínea si hace falta o acortar texto.

---

## Comparación con Referentes

| Aspecto | Certificado actual | AFIP / Banco |
|--------|---------------------|--------------|
| Logo | No | Sí |
| Tipografía | Helvetica solo | Times + Helvetica |
| Jerarquía | Débil | Clara |
| Contenido útil | Contaminado por template | Solo datos relevantes |
| Espaciado | Uniforme | Con ritmo |

---

## Recomendaciones Prioritarias

1. **Inmediato:** Corregir extracción de contenido (usar `message.content`).
2. **Alta:** Añadir logo en el header.
3. **Alta:** Usar Times para títulos principales.
4. **Media:** Ajustar jerarquía y espaciado.
5. **Media:** Redistribuir ancho de columnas en la bitácora.
6. **Baja:** Mejorar corte de líneas en cadena de integridad.

---

## Comandos sugeridos

- Contenido: ajustar en `certificate-generator.ts`
- Gráficos: `/polish` + cambios directos en el generador
