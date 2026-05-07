# Auditoría del Certificado PDF - Notificas

**Fecha:** 18 de marzo de 2025  
**Archivo:** `src/lib/certificate-generator.ts`  
**Componente relacionado:** `src/components/dashboard/download-certificate.tsx`

---

## Veredicto Anti-Patterns

**¿Parece genérico o desalineado con la marca?** Parcialmente. El certificado tiene buen formato legal pero:

| Tell | Ubicación | Severidad |
|------|-----------|-----------|
| Colores azules (#1f6feb, #153e75) | COLORS object | Alta – la app usa teal/turquesa (primary 186° HSL) |
| Fuente Helvetica exclusiva | Todo el PDF | Media – tipografía genérica |
| Paleta discordante | Certificado vs app | Alta – inconsistencia de marca |
| Colores hard-codeados | download-certificate.tsx | Media – amber/blue sin tokens |

---

## Resumen Ejecutivo

- **Total hallazgos:** 12
- **Críticos:** 2
- **Altos:** 4
- **Medios:** 4
- **Bajos:** 2
- **Puntuación:** 7/10 – Estructura profesional, desalineación de marca

**Top 3 críticos:**
1. Paleta de colores del PDF no coincide con la marca Notificas (teal/turquesa)
2. Componente download-certificate usa `bg-amber-50`, `text-blue-600` hard-codeados
3. Falta metadata del PDF (título, autor) para profesionalismo y accesibilidad

---

## Hallazgos por Severidad

### Críticos

| # | Ubicación | Categoría | Descripción | Recomendación |
|---|-----------|-----------|-------------|----------------|
| 1 | certificate-generator.ts L67-76 | Marca | COLORS.primary = #1f6feb (azul); app usa HSL 186° (teal) | Convertir primary a RGB equivalente del teal de la app |
| 2 | download-certificate.tsx L72-109 | Theming | amber-50, amber-200, amber-600, blue-50, blue-200, blue-600, blue-800 hard-codeados | Usar tokens: bg-warning/10, border-warning, text-warning-foreground, bg-primary/10, etc. |

### Altos

| # | Ubicación | Categoría | Descripción | Recomendación |
|---|-----------|-----------|-------------|---------------|
| 3 | certificate-generator.ts | Metadatos | PDF sin título, autor, asunto | Añadir doc.setProperties() para profesionalismo |
| 4 | certificate-generator.ts L138 | Theming | drawBox usa setFillColor(255,255,255) explícito | Mantener para blancos; considerar variable |
| 5 | certificate-generator.ts | Jerarquía | Section titles todo UPPERCASE – legible pero monótono | Ya está bien para documento legal; opcional variar |
| 6 | download-certificate.tsx L81 | UX | Emoji ⚠️ en texto – inconsistente con auditoría web | Usar icono AlertTriangle (ya presente) sin emoji en copy |

### Medios

| # | Ubicación | Descripción | Recomendación |
|---|-----------|-------------|---------------|
| 7 | certificate-generator.ts | Helvetica en todo el documento | jsPDF limita fuentes; aceptable para legal |
| 8 | certificate-generator.ts | Tabla: filas alternadas 255,255,255 vs bgSoft | Buen contraste B&N – mantener |
| 9 | certificate-generator.ts | Línea 516: `formatDate(movement.timestamp ?? movement.timestamp?.seconds)` – lógica redundante | Corregir: si timestamp es object con seconds, usar toDate |
| 10 | download-certificate.tsx L98 | "💡 Uso legal" – emoji decorativo | Quitar emoji o reemplazar por icono |

### Bajos

| # | Ubicación | Descripción |
|---|-----------|-------------|
| 11 | certificate-generator.ts | Comentario "ajustá estos según tu marca" – ya no aplica tras alineación |
| 12 | certificate-generator.ts | success/successBg definidos pero no usados en el PDF | Eliminar o usar en estados de lectura |

---

## Hallazgos Positivos

- Estructura clara de secciones (Resumen, Identificación, Técnicos, Contenido, Adjuntos, Bitácora, Declaración)
- Buena legibilidad para impresión B&N (contraste, bordes visibles)
- Formato judicial adecuado (encabezado, pie con ID, paginación)
- Monospace para IDs, URLs y hashes – apropiado
- Title Case en labels – legible sin gritar

---

## Conversión de Colores (App → PDF)

La app usa en globals.css:
- `--primary: 186 78% 37%` → RGB aprox. (19, 159, 167) – teal
- `--accent: 208 38% 29%` → RGB aprox. (46, 87, 118) – azul oscuro

Para el PDF se recomienda:
- primary: [19, 159, 167] (teal Notificas)
- primaryDark: [14, 100, 105] (teal más oscuro para títulos)

---

## Comandos Sugeridos

| Problema | Acción |
|----------|--------|
| Colores PDF | Editar COLORS en certificate-generator.ts |
| Tokens download-certificate | Reemplazar amber/blue por warning/primary |
| Metadata PDF | Añadir setProperties en generateCertificatePDF |
| Emojis en copy | Eliminar ⚠️ y 💡 del componente |
