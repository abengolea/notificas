export type CertificateMovement = {
  type?: string;
  timestamp?: unknown;
  viewerIsSender?: boolean;
};

export function firstCertificateMovement(
  movements: CertificateMovement[],
  types: string[]
): CertificateMovement | undefined {
  const set = new Set(types.map((t) => t.toLowerCase()));
  return movements.find((m) => set.has(String(m.type || '').toLowerCase()));
}

export function hasCertificateMovement(movements: CertificateMovement[], types: string[]): boolean {
  return Boolean(firstCertificateMovement(movements, types));
}

/** Hechos de apertura/lectura de correo derivados solo de movimientos (nunca de tracking.opened). */
export type EmailEvidenceState = {
  resendSignal: CertificateMovement | undefined;
  legacyPixel: CertificateMovement | undefined;
  linkClicked: CertificateMovement | undefined;
  readerOpen: CertificateMovement | undefined;
  appOpen: CertificateMovement | undefined;
  readConfirmed: CertificateMovement | undefined;
};

export type WhatsAppEvidenceState = {
  metaRead: CertificateMovement | undefined;
  linkClicked: CertificateMovement | undefined;
};

export function deriveEmailEvidence(movements: CertificateMovement[]): EmailEvidenceState {
  return {
    resendSignal: firstCertificateMovement(movements, ['resend_opened_signal']),
    legacyPixel: firstCertificateMovement(movements, ['email_opened']),
    linkClicked: firstCertificateMovement(movements, ['link_clicked']),
    readerOpen: firstCertificateMovement(movements, ['reader_magic_open']),
    appOpen: firstCertificateMovement(movements, ['app_opened']),
    readConfirmed: firstCertificateMovement(movements, ['read_confirmed']),
  };
}

export function deriveWhatsAppEvidence(movements: CertificateMovement[]): WhatsAppEvidenceState {
  return {
    metaRead: firstCertificateMovement(movements, ['whatsapp_read']),
    linkClicked: firstCertificateMovement(movements, ['whatsapp_link_clicked']),
  };
}

export function formatEvidenceStatus(detected: boolean): 'Sí' | 'No consta' {
  return detected ? 'Sí' : 'No consta';
}

export function emailResendSignalDetected(state: EmailEvidenceState): boolean {
  return Boolean(state.resendSignal);
}

export function emailLegacyPixelDetected(state: EmailEvidenceState): boolean {
  return Boolean(state.legacyPixel);
}

export function emailReaderOpenDetected(state: EmailEvidenceState): boolean {
  return Boolean(state.readerOpen);
}

export function emailReadConfirmedDetected(state: EmailEvidenceState): boolean {
  return Boolean(state.readConfirmed);
}

export function emailReaderAccessDetected(state: EmailEvidenceState): boolean {
  return Boolean(state.readerOpen || state.readConfirmed);
}

export function emailLinkClickedDetected(state: EmailEvidenceState): boolean {
  return Boolean(state.linkClicked);
}

export function emailAppOpenDetected(state: EmailEvidenceState): boolean {
  const m = state.appOpen;
  return Boolean(m && !m.viewerIsSender);
}

export function whatsAppMetaReadDetected(state: WhatsAppEvidenceState): boolean {
  return Boolean(state.metaRead);
}

export function whatsAppLinkClickedDetected(state: WhatsAppEvidenceState): boolean {
  return Boolean(state.linkClicked);
}

/** Resumen en lenguaje claro para la columna de correo. */
export function emailChannelStatusLine(state: EmailEvidenceState): string {
  if (emailReadConfirmedDetected(state)) return 'Lectura confirmada en el lector certificado';
  if (emailReaderOpenDetected(state)) return 'Contenido accedido en el lector certificado';
  if (emailLinkClickedDetected(state)) return 'Enlace pulsado desde el correo';
  if (emailAppOpenDetected(state)) return 'Abierto en la aplicación web';
  if (emailResendSignalDetected(state) || emailLegacyPixelDetected(state)) {
    return 'Apertura del correo registrada';
  }
  return 'Sin apertura registrada a la emisión';
}

/** Resumen en lenguaje claro para la columna de WhatsApp. */
export function whatsAppChannelStatusLine(
  state: WhatsAppEvidenceState,
  delivered: boolean
): string {
  if (whatsAppMetaReadDetected(state)) return 'Leído en el chat';
  if (whatsAppLinkClickedDetected(state)) return 'Acceso desde el enlace del mensaje';
  if (delivered) return 'Entregado al teléfono';
  return 'Sin entrega registrada a la emisión';
}

/** Resumen en lenguaje claro (correo y WhatsApp por separado). */
export function buildNotificationHumanSummary(input: {
  hasWhatsApp: boolean;
  waDelivered: boolean;
  email: EmailEvidenceState;
  whatsapp: WhatsAppEvidenceState;
  mailAccepted: boolean;
}): string {
  const emailParts: string[] = [];
  const waParts: string[] = [];

  if (input.mailAccepted) emailParts.push('envío aceptado por el servidor de correo');
  if (emailLinkClickedDetected(input.email)) emailParts.push('enlace pulsado desde el correo');
  if (emailReadConfirmedDetected(input.email)) {
    emailParts.push('lectura confirmada en el lector certificado');
  } else if (emailReaderOpenDetected(input.email)) {
    emailParts.push('contenido accedido en el lector certificado');
  } else if (emailResendSignalDetected(input.email) || emailLegacyPixelDetected(input.email)) {
    emailParts.push('apertura del correo registrada');
  }

  if (input.hasWhatsApp) {
    if (input.waDelivered) waParts.push('entregado al teléfono');
    if (whatsAppMetaReadDetected(input.whatsapp)) waParts.push('leído en el chat');
    if (whatsAppLinkClickedDetected(input.whatsapp)) {
      waParts.push('acceso desde el enlace del mensaje');
    } else if (input.waDelivered || whatsAppMetaReadDetected(input.whatsapp)) {
      waParts.push('sin constar acceso desde el enlace del mensaje');
    }
  }

  const lines: string[] = [];
  if (emailParts.length > 0) {
    lines.push(`Correo electrónico: ${emailParts.join('; ')}.`);
  }
  if (waParts.length > 0) {
    lines.push(`WhatsApp: ${waParts.join('; ')}.`);
  }
  if (lines.length === 0) return 'Sin hechos de entrega o lectura registrados a la emisión.';
  return lines.join(' ');
}
