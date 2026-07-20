import type { Metadata } from "next";

/** Dominio canónico de producción (App Hosting). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://notificas.com.ar"
).replace(/\/$/, "");

export const SITE_NAME = "Notificas";
export const SITE_LEGAL_NAME = "Notificas SRL";
export const SITE_TAGLINE =
  "Notificaciones fehacientes digitales con certificación en blockchain";

export const DEFAULT_TITLE =
  "Notificas | Notificaciones fehacientes digitales certificadas en blockchain";

export const DEFAULT_DESCRIPTION =
  "Enviá notificaciones fehacientes digitales con valor probatorio. Certificá envío, recepción y lectura en Polygon. Más económico y trazable que una carta documento.";

export const SITE_KEYWORDS = [
  "notificaciones fehacientes",
  "notificación fehaciente digital",
  "carta documento digital",
  "notificaciones certificadas",
  "notificación certificada online",
  "comunicación fehaciente",
  "intimación digital",
  "certificado blockchain",
  "Polygon",
  "prueba de envío",
  "prueba de lectura",
  "notificaciones legales Argentina",
  "Notificas",
] as const;

export const SITE_CONTACT = {
  email: "contacto@notificas.com",
  phone: "+54-9-336-464-5357",
  phoneDisplay: "+54 9 336 464-5357",
  address: {
    streetAddress: "Colón 12, primer piso",
    addressLocality: "San Nicolás de los Arroyos",
    addressRegion: "Buenos Aires",
    addressCountry: "AR",
  },
  cuit: "33-71729868-9",
} as const;

/** FAQs en texto plano para Schema.org FAQPage (sin JSX). */
export const FAQ_SEO_ITEMS: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: "¿Qué es Notificas?",
    answer:
      "Notificas es una plataforma de notificaciones fehacientes digitales. Cada comunicación que enviás queda certificada en la red Polygon (blockchain pública): el contenido del mensaje, la fecha y hora de envío, la recepción y la lectura del destinatario. Todo queda registrado de forma inmutable y verificable por cualquier persona.",
  },
  {
    question: "¿Qué eventos se certifican en blockchain?",
    answer:
      "Certificamos cuatro eventos en cadena: el envío (con hash SHA-256 del contenido e ID del servidor SMTP), la recepción (primer acceso fehaciente del destinatario), la lectura confirmada (cuando el destinatario confirma explícitamente haber leído), y el certificado PDF (hash del documento oficial, encadenado al envío). Todos los eventos están vinculados entre sí mediante referencias criptográficas.",
  },
  {
    question: "¿Qué pasa con el canal de WhatsApp?",
    answer:
      "Además del correo electrónico, enviamos una notificación por WhatsApp al destinatario. Registramos el envío del mensaje, la entrega al dispositivo, la apertura del enlace y la lectura del contenido. Todos estos eventos también quedan certificados en Polygon.",
  },
  {
    question: "¿Equivale a una carta documento?",
    answer:
      "Es más económico, más rápido y con mayor trazabilidad que una carta documento tradicional — hasta 20 veces más barato, sin necesidad de concurrir a ninguna oficina. El certificado que generamos tiene valor probatorio y puede presentarse ante autoridades judiciales o administrativas. Para casos específicos que exijan una forma legal determinada, consultá con tu asesor legal.",
  },
  {
    question: "¿Qué pasa si el destinatario no abre el correo?",
    answer:
      "Igual queda constancia del envío certificado en Polygon. Si el destinatario no abre el mensaje, el sistema registra el intento de entrega y el estado de la comunicación. Podés también notificar por WhatsApp simultáneamente, lo que amplia la cobertura del intento fehaciente. El certificado PDF refleja todos los eventos ocurridos hasta el momento en que lo descargás.",
  },
  {
    question: "¿Por cuánto tiempo se conserva la documentación?",
    answer:
      "Toda la documentación asociada a tus envíos se conserva por un mínimo de 5 años. Las transacciones en Polygon son permanentes por naturaleza: ningún tercero, ni siquiera Notificas, puede modificarlas o eliminarlas una vez confirmadas.",
  },
  {
    question: "¿Cómo se usa el certificado en un juicio o reclamo?",
    answer:
      "Desde el dashboard podés descargar el certificado PDF oficial de cualquier envío. Ese documento incluye todos los eventos certificados, los hashes SHA-256, los hash de transacción en Polygon y la cadena de eventos. El hash del propio PDF también queda anclado en blockchain, lo que garantiza que no fue alterado. Podés presentarlo directamente en cualquier expediente.",
  },
  {
    question: "¿Cómo verifico que un certificado es auténtico?",
    answer:
      "Ingresá a la sección Verificar certificado y subí el PDF o ingresá el ID del mensaje. El sistema compara el hash del documento con el registrado en Polygon. Si coincide, el certificado es auténtico y no fue modificado. También podés verificar la transacción de forma independiente en polygonscan.com ingresando el hash de TX que figura en el PDF.",
  },
  {
    question: "¿Cómo empiezo a usar Notificas?",
    answer:
      "Creá tu cuenta en Registro — el proceso toma menos de dos minutos. Desde el dashboard podés cargar créditos y empezar a enviar notificaciones certificadas de inmediato. Para cuentas corporativas o de volumen, usá el acceso empresas.",
  },
];

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
  ogImage?: string;
};

export function createPageMetadata({
  title,
  description,
  path,
  keywords,
  noIndex = false,
  ogImage = "/notificasLogo.jpg",
}: PageMetadataOptions): Metadata {
  const url = absoluteUrl(path);
  const imageUrl = absoluteUrl(ogImage);

  return {
    title,
    description,
    keywords: keywords?.length ? [...keywords] : undefined,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "es_AR",
      type: "website",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    robots: noIndex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : { index: true, follow: true },
  };
}

export const NO_INDEX_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};
