export type PublicResource = {
  path: string;
  title: string;
  description: string;
  blurb: string;
  keywords?: readonly string[];
};

/** Hub de artículos informativos. */
export const RESOURCE_HUB = {
  path: "/recursos",
  title: "Recursos sobre comunicaciones digitales verificables",
  description:
    "Guías de Notificas sobre notificaciones por WhatsApp, evidencia, intimaciones, envíos masivos, email verificable y diferencias con la carta documento.",
  blurb: "Artículos informativos para empresas, profesionales y verificación pública.",
} as const satisfies PublicResource;

/** Guías públicas ya existentes. */
export const SEO_GUIDE_PAGES = [
  {
    path: "/notificacion-fehaciente-digital",
    title: "Qué es una notificación fehaciente digital",
    description:
      "Qué deja constancia Notificas, qué no prueba un correo aceptado y cómo se usa un certificado de lectura en Argentina.",
    blurb: "Qué se registra, qué no, y cómo usarlo.",
  },
  {
    path: "/carta-documento-digital",
    title: "Carta documento digital: qué cubre Notificas y qué no",
    description:
      "Notificas no reemplaza una carta documento si la ley pide esa forma. Compará costos, plazos y valor de la constancia técnica.",
    blurb: "No reemplaza la carta documento. Sí deja rastro comprobable.",
  },
  {
    path: "/notificaciones-whatsapp-empresas",
    title: "Notificaciones por WhatsApp para empresas",
    description:
      "Campañas de volumen por WhatsApp Business: plantillas de Meta, qué se certifica y cómo se cotizan los envíos masivos.",
    blurb: "Plantillas de Meta, trazabilidad y campañas de volumen.",
  },
  {
    path: "/como-verificar-certificado",
    title: "Cómo verificar un certificado de Notificas",
    description:
      "Subí el PDF o ingresá el ID en notificas.com.ar/verify. Comparamos la huella del archivo con el registro en Polygon.",
    blurb: "Validá un PDF o un ID contra Polygon.",
  },
] as const satisfies readonly PublicResource[];

/** Landings GEO/AEO nuevas: una pregunta real por URL. */
export const GEO_LANDING_PAGES = [
  {
    path: "/notificacion-whatsapp",
    title: "Notificaciones por WhatsApp con evidencia verificable",
    description:
      "Notificaciones por WhatsApp con evidencia verificable: registro de envío, destinatario y eventos. El valor jurídico depende del caso y la forma exigida.",
    blurb: "Cómo notificar por WhatsApp y qué evidencia queda del envío.",
    keywords: [
      "notificación WhatsApp",
      "notificar por WhatsApp",
      "WhatsApp comunicación formal",
      "acreditar envío WhatsApp",
    ],
  },
  {
    path: "/whatsapp-como-prueba",
    title: "WhatsApp como prueba: qué evidencia conviene conservar",
    description:
      "Qué evidencia de WhatsApp conviene conservar: contenido, destinatario, fecha, entrega, lectura e integridad. El valor jurídico depende del caso.",
    blurb: "Qué conservar si un WhatsApp puede usarse como elemento de prueba.",
    keywords: [
      "WhatsApp como prueba",
      "evidencia WhatsApp",
      "prueba de mensajes WhatsApp",
      "trazabilidad WhatsApp",
    ],
  },
  {
    path: "/intimacion-deuda-whatsapp",
    title: "Intimaciones de deuda por WhatsApp: evidencia y trazabilidad",
    description:
      "Intimaciones de deuda por WhatsApp: cómo dejar rastro técnico del envío y la entrega, y por qué eso no equivale automáticamente a un requisito legal.",
    blurb: "Cobranza empresarial: comunicar, acreditar el envío y cumplir formas.",
    keywords: [
      "intimación de deuda WhatsApp",
      "intimar deuda por WhatsApp",
      "cobranza WhatsApp",
      "mora WhatsApp empresas",
    ],
  },
  {
    path: "/notificaciones-masivas-empresas",
    title: "Notificaciones digitales masivas para empresas",
    description:
      "Notificaciones digitales masivas para empresas: WhatsApp y email a escala, carga CSV, trazabilidad por destinatario y cotización según el caso.",
    blurb: "Envíos de volumen para fintech, bancos, seguros, ecommerce y servicios.",
    keywords: [
      "notificaciones masivas empresas",
      "notificaciones digitales masivas",
      "campañas WhatsApp empresas",
      "notificaciones masivas CSV",
    ],
  },
  {
    path: "/email-certificado",
    title: "Email verificable: cómo conservar evidencia de una comunicación",
    description:
      "Email verificable: cómo conservar evidencia de envío, destinatario, contenido y estado. No equivale por sí solo a una forma legal determinada.",
    blurb: "Evidencia de correo: envío, estado, trazabilidad y conservación.",
    keywords: [
      "email certificado",
      "email verificable",
      "correo con constancia de envío",
      "evidencia de email",
    ],
  },
  {
    path: "/notificacion-digital-vs-carta-documento",
    title: "Notificación digital y carta documento: diferencias y casos de uso",
    description:
      "Notificación digital y carta documento: compará forma, costos, velocidad, evidencia y límites jurídicos. No son necesariamente equivalentes.",
    blurb: "Comparación seria: no son el mismo acto ni sustituyen formas exigidas.",
    keywords: [
      "notificación digital vs carta documento",
      "carta documento digital",
      "diferencia carta documento WhatsApp",
      "forma de notificación Argentina",
    ],
  },
] as const satisfies readonly PublicResource[];

export const LEGAL_PUBLIC_PAGES = [
  {
    path: "/consumidores",
    title: "Defensa del Consumidor",
    description:
      "Información de Defensa del Consumidor de Notificas SRL conforme a la Ley 24.240.",
    blurb: "Datos del prestador, reclamos y canales de contacto.",
  },
  {
    path: "/terminos",
    title: "Términos y Condiciones",
    description: "Términos y condiciones del servicio de Notificas SRL.",
    blurb: "Condiciones de uso del servicio.",
  },
  {
    path: "/privacidad",
    title: "Política de Privacidad",
    description: "Política de privacidad y tratamiento de datos personales de Notificas.",
    blurb: "Tratamiento de datos personales.",
  },
  {
    path: "/arrepentimiento",
    title: "Derecho de Arrepentimiento",
    description: "Ejercé el derecho de arrepentimiento sobre planes contratados en Notificas.",
    blurb: "Plazo y canal para arrepentirse de una contratación.",
  },
] as const satisfies readonly PublicResource[];

export type SeoGuidePath = (typeof SEO_GUIDE_PAGES)[number]["path"];
export type GeoLandingPath = (typeof GEO_LANDING_PAGES)[number]["path"];

export const ALL_RESOURCE_PAGES = [
  RESOURCE_HUB,
  ...SEO_GUIDE_PAGES,
  ...GEO_LANDING_PAGES,
] as const;

export function relatedResources(currentPath: string, limit = 6): PublicResource[] {
  const pool: PublicResource[] = [...SEO_GUIDE_PAGES, ...GEO_LANDING_PAGES];
  return pool.filter((page) => page.path !== currentPath).slice(0, limit);
}
