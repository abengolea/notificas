import {
  effectiveMixedDeliveryMode,
  isMixedDeliveryMode,
  mixedModeEmailIsDirect,
  mixedModeWhatsAppUsesReader,
} from '@/lib/campaign-mixed-message';
import { usesNotificasDefaultTemplate } from '@/lib/wa-template-fields';

/**
 * Qué viajó realmente por cada canal. Se registra al sellar el envío: la constancia da fe de esto
 * y no de la configuración que tenga la campaña después.
 *
 * - email 'text': el cuerpo del correo trae el texto completo, sin lector.
 * - email 'reader_notice': el correo es un aviso con un botón que abre el lector; la carta se lee ahí.
 * - whatsapp 'reader_link': el mensaje lleva el enlace al lector.
 * - whatsapp 'template': plantilla de Meta tal cual, sin enlace al lector.
 */
export type DeliveryFacts = {
  email: 'text' | 'reader_notice' | null;
  whatsapp: 'reader_link' | 'template' | null;
  /** 'sealed': registrado al enviar. 'campaign_config': envío anterior a este registro, deducido de la campaña. */
  source: 'sealed' | 'campaign_config';
};

type MailLike = {
  emailDirect?: unknown;
  waOnly?: unknown;
  waTemplateName?: unknown;
  waUrlButton?: unknown;
  waTemplateVariables?: unknown;
};

const READER_VARS = new Set(['url_lectura', 'boton_url']);

/** Hechos del envío a partir del mail ya despachado (se llama al sellar). */
export function deliveryFactsFromMail(
  mail: MailLike,
  sent: { hasEmail: boolean; hasWhatsApp: boolean }
): DeliveryFacts {
  let whatsapp: DeliveryFacts['whatsapp'] = null;
  if (sent.hasWhatsApp) {
    const name = String(mail.waTemplateName || '').trim();
    const vars = Array.isArray(mail.waTemplateVariables) ? (mail.waTemplateVariables as unknown[]) : [];
    const readerInTemplate = mail.waUrlButton === true || vars.some((v) => READER_VARS.has(String(v)));
    // La plantilla de Notificas siempre lleva el enlace al lector.
    whatsapp = usesNotificasDefaultTemplate(name) || readerInTemplate ? 'reader_link' : 'template';
  }
  return {
    email: sent.hasEmail ? (mail.emailDirect === true ? 'text' : 'reader_notice') : null,
    whatsapp,
    source: 'sealed',
  };
}

/** Envíos anteriores al registro: se deduce del modo de la campaña y se avisa en la constancia. */
export function deliveryFactsFromCampaignConfig(input: {
  canal?: string | null;
  mixedMode?: unknown;
  waTemplateName?: unknown;
  waUrlButton?: unknown;
  waTemplateVariables?: unknown;
}): DeliveryFacts | null {
  const canal = String(input.canal || '');
  if (canal === 'ambos' && isMixedDeliveryMode(input.mixedMode)) {
    const mode = effectiveMixedDeliveryMode(input.mixedMode, usesNotificasDefaultTemplate(String(input.waTemplateName || '')));
    return {
      email: mixedModeEmailIsDirect(mode) ? 'text' : 'reader_notice',
      whatsapp: mixedModeWhatsAppUsesReader(mode) ? 'reader_link' : 'template',
      source: 'campaign_config',
    };
  }
  return null;
}

export type DeliveryNarrative = {
  /** Una línea por canal para la tabla «Cómo se entregó». */
  emailLine: string | null;
  whatsappLine: string | null;
  /** Título del bloque del texto certificado. */
  textTitle: string;
  /** Explicación bajo el título. */
  textIntro: string;
  emailCaption: string;
  whatsappCaption: string;
  /** Aclaración sobre de dónde sale el dato (solo si no se registró al enviar). */
  sourceNote: string | null;
};

/**
 * Redacción de la constancia según lo que viajó. `sharesBody`: el texto del correo/lector y el del pedido a Meta
 * son el mismo. Cada frase solo afirma lo que `facts` registra; sin registro, no afirma nada del correo.
 */
export function describeDelivery(facts: DeliveryFacts | null, sharesBody: boolean): DeliveryNarrative {
  const emailLine =
    facts?.email === 'text'
      ? 'El texto completo viajó en el cuerpo del correo. No llevaba enlace al lector.'
      : facts?.email === 'reader_notice'
        ? 'El correo fue un aviso con el botón «Acceder a la notificación», que abre el lector. El texto no está en el cuerpo del correo: se lee en el lector.'
        : null;
  const whatsappLine =
    facts?.whatsapp === 'reader_link'
      ? 'Plantilla de Meta con el enlace al lector.'
      : facts?.whatsapp === 'template'
        ? 'Plantilla de Meta con su texto y sus variables. No lleva enlace al lector.'
        : null;
  const sourceNote =
    facts?.source === 'campaign_config'
      ? 'Este envío es anterior al registro de la forma de entrega: se indica según la configuración de la campaña, no según una copia sellada al enviar.'
      : null;

  let textTitle: string;
  let textIntro: string;
  if (facts?.email === 'reader_notice') {
    textTitle = 'Texto de la carta (la que se lee en el lector)';
    textIntro = sharesBody
      ? 'Esta es la carta que el destinatario lee en el lector, al que accede desde el botón del correo. El correo no trae este texto en su cuerpo. WhatsApp envió por separado la plantilla de Meta, cuyo texto coincide con esta carta. La huella SHA-256 del anexo es de este texto.'
      : 'Esta es la carta que el destinatario lee en el lector, al que accede desde el botón del correo. El correo no trae este texto en su cuerpo. La huella SHA-256 del anexo es de este texto.';
  } else if (facts?.email === 'text' && sharesBody) {
    textTitle = 'Texto del mensaje (común a correo y WhatsApp)';
    textIntro =
      'El cuerpo del correo y el globo de WhatsApp llevan el mismo texto: el BODY de la plantilla aprobada en Meta, con las variables ya sustituidas. No son dos textos distintos. Abajo, cada canal detalla solo lo propio. La huella SHA-256 del anexo es de este texto.';
  } else if (facts?.email === 'text') {
    textTitle = 'Texto del correo';
    textIntro = 'Este es el texto que viajó en el cuerpo del correo. La huella SHA-256 del anexo es de este texto.';
  } else {
    // Sin registro de cómo viajó el correo: no se afirma nada de eso.
    textTitle = 'Texto certificado';
    textIntro = sharesBody
      ? 'Este es el texto certificado de este envío; coincide con el BODY de la plantilla de Meta. Esta constancia no registra si el correo lo trajo en su cuerpo o se leía en el lector. La huella SHA-256 del anexo es de este texto.'
      : 'Este es el texto certificado de este envío. La huella SHA-256 del anexo es de este texto.';
  }

  const emailCaption =
    facts?.email === 'reader_notice'
      ? 'Lo que se despachó a la casilla: un aviso con botón que abre el lector, donde se lee la carta. Asunto e identificador SMTP son propios de este canal.'
      : facts?.email === 'text'
        ? 'Lo que se despachó a la casilla: el texto va en el cuerpo del correo. Asunto e identificador SMTP son propios de este canal.'
        : 'Lo que se despachó a la casilla. Asunto e identificador SMTP son propios de este canal.';
  const whatsappCaption =
    facts?.whatsapp === 'template'
      ? 'Plantilla de Meta, sin enlace al lector. Encabezado, pie, plantilla y variables son propios de WhatsApp.'
      : facts?.whatsapp === 'reader_link'
        ? 'Plantilla de Meta con el enlace al lector. Encabezado, pie, plantilla y variables son propios de WhatsApp.'
        : 'Globo pedido a Meta. Encabezado, pie, plantilla y variables son propios de WhatsApp.';

  return { emailLine, whatsappLine, textTitle, textIntro, emailCaption, whatsappCaption, sourceNote };
}
