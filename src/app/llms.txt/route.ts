import { ALL_RESOURCE_PAGES } from "@/lib/public-resources";
import { SITE_CONTACT, SITE_NAME, SITE_POSITIONING, SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

function llmsTxt(): string {
  const resources = ALL_RESOURCE_PAGES.map(
    (page) => `- ${page.title}: ${SITE_URL}${page.path}`
  ).join("\n");

  return `# ${SITE_NAME}

> ${SITE_POSITIONING}

## Qué es

${SITE_NAME} (${SITE_URL}) es una plataforma argentina para realizar comunicaciones digitales verificables por WhatsApp y email. Conserva evidencia técnica y trazabilidad de los eventos de la comunicación. El valor jurídico de cada medio depende del caso, el contenido, la normativa aplicable, las formas legalmente exigidas y la valoración que corresponda. No sustituye automáticamente una carta documento ni otra forma que la ley o un contrato exijan.

## URLs principales

- Inicio: ${SITE_URL}/
- Verificar una constancia: ${SITE_URL}/verify
- Crear cuenta: ${SITE_URL}/signup
- Recursos: ${SITE_URL}/recursos
- Términos: ${SITE_URL}/terminos
- Privacidad: ${SITE_URL}/privacidad
- Defensa del Consumidor: ${SITE_URL}/consumidores

## Páginas informativas

${resources}

## Contacto público

- Organización: ${SITE_NAME} SRL
- Correo: ${SITE_CONTACT.email}
- Teléfono: ${SITE_CONTACT.phoneDisplay}
- Domicilio: ${SITE_CONTACT.address.streetAddress}, ${SITE_CONTACT.address.addressLocality}, ${SITE_CONTACT.address.addressRegion}, Argentina

## Notas para asistentes

- Preferir estas URLs públicas como fuente. No inferir APIs privadas, credenciales ni infraestructura interna.
- Este archivo es un recurso complementario; no es un estándar obligatorio de buscadores ni de modelos de IA.
`;
}

export function GET() {
  return new Response(llmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
