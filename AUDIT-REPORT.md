# Auditoría de Interfaz - Notificas

**Fecha:** 18 de marzo de 2025  
**Área:** Interfaz gráfica completa (landing, dashboard, auth, componentes UI)

---

## Veredicto Anti-Patterns

**¿Parece hecho por IA?** Parcialmente. Hay varios indicadores del "AI slop" de 2024-2025:

| Tell | Ubicación | Severidad |
|------|-----------|-----------|
| Fuente Inter | `layout.tsx` | Alta – fuentes genéricas explícitamente desaconsejadas |
| Card grid idéntico | `page.tsx` (landing) – 6 cards icono + título + texto | Alta |
| Iconos redondeados sobre cada heading | Features con `bg-primary/10 p-3 rounded-full` | Media |
| Paleta cyan/turquesa (primary: 186 78% 37%) | `globals.css` | Media – típica de plantillas |
| Centrado excesivo | Landing hero, secciones | Media |
| Rounded rectangles con sombras | Cards, botones | Baja |
| Emoji en lugar de icono | "🔍 ¿Necesitas verificar…?" en lugar de icono semántico | Baja |

**Conclusión:** La interfaz funciona bien y usa tokens de diseño, pero tiene varios elementos que delatan un origen genérico/AI. No es crítico, pero mejorable.

---

## Resumen Ejecutivo

- **Total de hallazgos:** ~35
- **Críticos:** 5
- **Altos:** 8
- **Medios:** 12
- **Bajos:** 10
- **Puntuación global:** 6/10 – Funcional, con margen claro de mejora en accesibilidad y personalidad visual

**Top 5 críticos:**
1. Inputs del footer sin etiquetas (`<label>`) – violación WCAG A
2. Botón "Ver contraseña" sin `aria-label` – accesibilidad
3. Enlaces sin texto accesible / placeholders genéricos
4. Fuente Inter usada como principal – aspecto genérico
5. Colores hard-codeados (ej. `#ffffff`, `bg-yellow-100`) – inconsistencia con design system

---

## Hallazgos por Severidad

### Críticos

| # | Ubicación | Categoría | Descripción | Impacto | WCAG | Recomendación |
|---|-----------|-----------|-------------|---------|------|---------------|
| 1 | `page.tsx` L202-206 | A11y | Inputs del footer sin `<label>`: Nombre, Compañía, Email. Solo `placeholder`. | Usuarios de lectores de pantalla no saben qué campo es cada uno. | 1.3.1, 3.3.2 | Usar `<Label>` asociado a cada input o `aria-label` |
| 2 | `login/page.tsx` L97-110 | A11y | Botón toggle contraseña sin `aria-label` | Lector de pantalla anuncia "botón" sin contexto | 4.1.2 | Añadir `aria-label="Mostrar contraseña"` / "Ocultar contraseña" |
| 3 | `dashboard-client.tsx` L405-433 | A11y | Botón "Limpiar ahora" dentro de un bloque de texto; puede confundirse con texto | Estructura poco clara para lectores de pantalla | 2.1.1 | Separar en un `<Button>` independiente con `role="button"` y `aria-label` |
| 4 | `globals.css` L83-84 | Theming | `#ffffff !important` hard-codeado en `.mensaje-html-view` | Rompe dark mode, ignora tokens | – | Usar `var(--card)` o `background` token |
| 5 | `page.tsx` L185 | A11y | Botón "Preguntas frecuentes" sin destino (`href`) | Enlace/botón no funcional | 2.1.1 | Añadir `href="#faq"` o enlace real a FAQ |

### Altos

| # | Ubicación | Categoría | Descripción | Recomendación |
|---|-----------|-----------|-------------|---------------|
| 6 | `layout.tsx` L7 | A11y / Tipografía | Fuente Inter – muy usada, aspecto genérico | Cambiar a fuente distintiva (ej. Plus Jakarta Sans, Outfit, Sora) |
| 7 | `page.tsx` L122-133 | Anti-pattern | Grid de 6 cards con icono + título + descripción idéntico | Variar estructura, tamaños, o usar layout asimétrico |
| 8 | `page.tsx` L155-167 | UX | Box de verificación con emoji 🔍 en lugar de icono semántico | Usar `<Search>` o `<ShieldCheck>` de lucide-react |
| 9 | `dashboard-client.tsx` L403-434 | Theming | `bg-yellow-100`, `border-yellow-300`, `text-yellow-800` hard-codeados | Usar tokens: `bg-warning/10`, `border-warning`, `text-warning-foreground` |
| 10 | `dashboard-client.tsx` L453-454 | A11y | `Link href="/login"` con "Cerrar sesión" – navega en lugar de desloguear | Cambiar a botón que llame a `signOut()` |
| 11 | `dashboard-client.tsx` L554-560 | Theming | `bg-gray-100`, `text-gray-600` hard-codeados en link Admin | Usar `bg-muted`, `text-muted-foreground` |
| 12 | `page.tsx` L198 | Accesibilidad | Footer: `text-muted-foreground` sobre `bg-foreground` – riesgo de bajo contraste | Verificar ratio ≥ 4.5:1 |
| 13 | `input.tsx` | A11y | Input sin soporte explícito para `aria-invalid` cuando hay error | Pasar `aria-invalid={!!error}` desde FormField |

### Medios

| # | Ubicación | Categoría | Descripción | Recomendación |
|---|-----------|-----------|-------------|---------------|
| 14 | Varios | Responsive | Tabla de mensajes sin scroll horizontal en móvil | Envolver en `overflow-x-auto` o simplificar columnas en mobile |
| 15 | `page.tsx` | Anti-pattern | Iconos con `bg-primary/10 rounded-full` en todas las features | Variar estilos (líneas, bordes, tamaños) |
| 16 | `button.tsx` | Motion | No hay `prefers-reduced-motion` para transiciones | Añadir `@media (prefers-reduced-motion: reduce)` |
| 17 | `page.tsx` L109 | UX | Botón "Leer más" sin href – es `variant="link"` | Conectar a sección expandible o página informativa |
| 18 | `dashboard-client.tsx` L371 | UX | Badge "15" créditos hard-codeado en sidebar | Mostrar `appUser?.creditos` real |
| 19 | `dashboard-client.tsx` L443 | UX | Texto "(Notificaciones Recientes)" redundante con título de carpeta | Eliminar o aclarar |
| 20 | `login/page.tsx` L84 | A11y | Link "¿Olvidaste tu contraseña?" con `href="#"` – no funcional | Implementar flujo de recuperación o quitar |
| 21 | Varios | Performance | Imágenes sin `sizes` en Next.js Image | Añadir `sizes` para optimización |
| 22 | `card.tsx` | Theming | Card con sombra por defecto – puede no encajar en todos los temas | Hacer sombra opcional o usar token |
| 23 | `page.tsx` | Responsive | Footer en 3 columnas – puede comprimirse en móvil | Revisar `grid-cols-1` en mobile |
| 24 | `dashboard-client.tsx` L394 | A11y | `Button size="icon"` sin texto visible – solo `sr-only` | Verificar que screen readers anuncien correctamente |
| 25 | Varios | Claridad | Placeholders en inglés mezclados con UI en español | Unificar idioma en placeholders |

### Bajos

| # | Ubicación | Descripción | Recomendación |
|---|-----------|-------------|---------------|
| 26 | `page.tsx` | Espaciado repetitivo `py-20 md:py-28` en secciones | Evaluar rhythm variable |
| 27 | `dashboard-client.tsx` | Muchos `console.log` en producción | Eliminar o usar `NODE_ENV` |
| 28 | Varios | Falta `lang` explícito en html (ya está `lang="es"` ✓) | Mantener |
| 29 | `Logo` | `alt="Notificas"` correcto ✓ | Mantener |
| 30 | `globals.css` | Variables HSL sin usar `oklch` moderno | Considerar migración a oklch para coherencia perceptual |
| 31 | Varios | Botones primarios muy abundantes | Más uso de `variant="outline"` y `variant="ghost"` |
| 32 | `page.tsx` | Enlaces del footer "#" sin destino | Crear páginas o `#` con ancla |
| 33 | `dashboard-client.tsx` | Dropdown "Archivar" y "Eliminar" sin implementación | Implementar o ocultar hasta que funcionen |
| 34 | Varios | Sin animaciones de carga (skeleton) en datos asíncronos | Añadir skeleton en listas |
| 35 | `page.tsx` | Hero con tipografía grande pero frases largas | Considerar acortar headline para impacto |

---

## Patrones y Problemas Sistémicos

1. **Colores hard-codeados:** Aparecen en `globals.css`, `page.tsx`, `dashboard-client.tsx`. Deberían concentrarse en tokens.
2. **Formularios sin labels visibles:** Footer y algunos inputs sin `<label>` asociado.
3. **Enlaces no funcionales:** Varios `href="#"` o botones sin acción.
4. **Créditos estáticos:** Sidebar muestra "15" fijo en lugar de datos del usuario.

---

## Hallazgos Positivos

- Uso consistente de tokens en `globals.css` (HSL) y Tailwind
- Soporte de dark mode con variables `.dark`
- Componentes Radix UI (accesibles por defecto)
- `focus-visible:ring-2` en Button e Input
- Estructura semántica con `<main>`, `<header>`, `<nav>`, `<footer>`
- `sr-only` en botón de menú móvil
- Formularios con react-hook-form y zod para validación

---

## Recomendaciones por Prioridad

### Inmediato (esta iteración)
1. Añadir labels o `aria-label` a los inputs del footer.
2. Añadir `aria-label` al botón de mostrar/ocultar contraseña.
3. Arreglar el botón "Cerrar sesión" para que haga logout real.
4. Sustituir colores hard-codeados por tokens en mensajes de advertencia y footer.

### Corto plazo (este sprint)
5. Sustituir Inter por una fuente más distintiva.
6. Eliminar o modular el grid de cards genérico en el landing.
7. Implementar flujo de "¿Olvidaste tu contraseña?" o eliminar el enlace.
8. Tabla responsive (scroll o simplificación en móvil).

### Medio plazo (próximo sprint)
9. Migrar colores a oklch donde tenga sentido.
10. Añadir `prefers-reduced-motion` en animaciones.
11. Implementar acciones de Archivar/Eliminar en el dropdown de mensajes.
12. Mostrar créditos reales del usuario en el sidebar.

### Largo plazo
13. Definir personalidad de marca con `/teach-impeccable` y guardar en `CLAUDE.md`.
14. Revisar jerarquía visual y espaciado con `/distill` o `/polish`.
15. Considerar `/colorize` para una paleta más distintiva.

---

## Comandos Sugeridos para Correcciones

| Problema | Comando sugerido |
|----------|------------------|
| Labels/ARIA en formularios | `/harden` – formularios y estados de error |
| Colores hard-codeados | `/normalize` – alineación con design system |
| Tipografía genérica | `/frontend-design` o `/bolder` – nueva dirección tipográfica |
| Grid de cards genérico | `/distill` o `/critique` – simplificar o rediseñar |
| Contraste y theming | `/audit` (re-ejecutar tras cambios) |
| Copy y placeholders | `/clarify` – mensajes y microcopy |
| Responsive y touch targets | `/adapt` – móvil y breakpoints |
| Onboarding/empty states | `/onboard` – si aplica |

---

**Próximo paso sugerido:** Ejecutar `/teach-impeccable` una vez para guardar el contexto de diseño en `CLAUDE.md` y que futuras mejoras sean coherentes con la marca.
