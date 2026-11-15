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
  /** Aclaración sobre de dónde sale el dato (solo si no se registró al enviar). */
  sourceNote: string | null;
  /** Dentro del recuadro del correo: aviso de lo que NO traía (solo si fue aviso con lector). */
  emailNotice: string | null;
  /** Rótulo del texto dentro del recuadro del correo (null si el correo no traía el texto). */
  emailTextLabel: string | null;
  /** El texto certificado se muestra en un recuadro propio, el del lector. */
  hasReaderBox: boolean;
  /** Dentro del recuadro de WhatsApp: qué tipo de mensaje fue. */
  whatsappNote: string | null;
  /** Dentro del recuadro de WhatsApp, cuando su texto es el mismo que el certificado. */
  whatsappSameTextNote: string | null;
  /** Marca el recuadro cuyo texto reproduce la huella SHA-256 del anexo. */
  hashNote: string;
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

  const emailNotice =
    facts?.email === 'reader_notice'
      ? 'El correo no traía el texto. Traía un aviso con el botón «Acceder a la notificación», que abre el lector. La carta que se lee ahí está en el recuadro siguiente.'
      : null;
  const emailTextLabel =
    facts?.email === 'reader_notice'
      ? null
      : facts?.email === 'text'
        ? 'Texto en el cuerpo del correo:'
        : 'Texto certificado (esta constancia no registra si llegó en el cuerpo del correo o se leía en el lector):';
  const whatsappNote =
    facts?.whatsapp === 'template'
      ? 'Plantilla de Meta, sin enlace al lector.'
      : facts?.whatsapp === 'reader_link'
        ? 'Plantilla de Meta con el enlace al lector.'
        : null;
  const whatsappSameTextNote = sharesBody
    ? facts?.email === 'reader_notice'
      ? 'Su texto es el mismo que el de la carta del lector.'
      : facts?.email === 'text'
        ? 'Su texto es el mismo que el del correo.'
        : 'Su texto coincide con el texto certificado.'
    : null;

  return {
    emailLine,
    whatsappLine,
    sourceNote,
    emailNotice,
    emailTextLabel,
    hasReaderBox: facts?.email === 'reader_notice',
    whatsappNote,
    whatsappSameTextNote,
    hashNote: 'Este es el texto que reproduce la huella SHA-256 del anexo técnico.',
  };
}
