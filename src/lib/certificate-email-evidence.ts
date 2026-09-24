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
  readerOpen: CertificateMovement | undefined;
  appOpen: CertificateMovement | undefined;
  readConfirmed: CertificateMovement | undefined;
};

export function deriveEmailEvidence(movements: CertificateMovement[]): EmailEvidenceState {
  return {
    resendSignal: firstCertificateMovement(movements, ['resend_opened_signal']),
    legacyPixel: firstCertificateMovement(movements, ['email_opened']),
    readerOpen: firstCertificateMovement(movements, ['reader_magic_open']),
    appOpen: firstCertificateMovement(movements, ['app_opened']),
    readConfirmed: firstCertificateMovement(movements, ['read_confirmed']),
  };
}

export function formatEvidenceStatus(detected: boolean): 'Sí' | 'No consta' {
  return detected ? 'Sí' : 'No consta';
}

/** Señal técnica informada por Resend (pixel/proxy del proveedor). */
export function emailResendSignalDetected(state: EmailEvidenceState): boolean {
  return Boolean(state.resendSignal);
}

/** Pixel histórico Notificas (movimiento email_opened). */
export function emailLegacyPixelDetected(state: EmailEvidenceState): boolean {
  return Boolean(state.legacyPixel);
}

/** Acceso al lector certificado o lectura confirmada. */
export function emailReaderAccessDetected(state: EmailEvidenceState): boolean {
  return Boolean(state.readerOpen || state.readConfirmed);
}

/** Apertura en app web del destinatario (excluye aperturas del remitente). */
export function emailAppOpenDetected(state: EmailEvidenceState): boolean {
  const m = state.appOpen;
  return Boolean(m && !m.viewerIsSender);
}

/** Resumen humano coherente con los movimientos (Parte I). */
export function emailChannelHumanSummary(state: EmailEvidenceState): string {
  if (emailReaderAccessDetected(state)) {
    return 'Accedido en el lector certificado';
  }
  if (emailAppOpenDetected(state)) {
    return 'Abierto en la aplicación web';
  }
  if (emailResendSignalDetected(state) || emailLegacyPixelDetected(state)) {
    return 'Señal técnica de apertura (no es lectura fehaciente)';
  }
  return 'Sin señales de apertura a la emisión';
}
