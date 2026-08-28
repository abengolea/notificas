export interface NotificasRecipient {
  name?: string;
  phone?: string;
  email?: string;
  document?: string;
}

export interface SendCertifiedNotificationInput {
  channel: "whatsapp" | "email";
  recipient: NotificasRecipient;
  template?: string;
  variables?: Record<string, string>;
  subject?: string;
  body?: string;
  reference?: string;
  metadata?: Record<string, string | number | boolean>;
  idempotencyKey?: string;
}

export interface NotificasClientOptions {
  /** Backend propio que reenvía a Notificas. Recomendado en sitios públicos. */
  proxyUrl?: string;
  apiKey?: string;
  allowBrowserKey?: boolean;
  baseUrl?: string;
  requestId?: string;
  /**
   * Si true, proxyUrl se concatena con el path completo `/api/v1/…`.
   * Por defecto el proxy reemplaza `https://notificas.com.ar/api/v1`
   * (`/api/notificas` + `/notifications`).
   */
  proxyMapsFullPath?: boolean;
}

export interface NotificasClient {
  version: string;
  sendCertifiedNotification(input: SendCertifiedNotificationInput): Promise<unknown>;
  getNotification(id: string): Promise<unknown>;
  getCertificate(id: string): Promise<unknown>;
  listNotifications(query?: Record<string, string | number>): Promise<unknown>;
  me(): Promise<unknown>;
}

export interface NotificasEmbedOptions extends NotificasClientOptions {
  channel?: "whatsapp" | "email";
  template?: string;
  title?: string;
  subtitle?: string;
  variables?: Record<string, string>;
  metadata?: Record<string, string | number | boolean>;
  hideTemplate?: boolean;
  showAllFields?: boolean;
  demo?: boolean;
  buttonLabel?: string;
  onSent?: (result: unknown) => void;
  onError?: (error: unknown) => void;
}

export interface NotificasGlobal {
  version: string;
  create(options: NotificasClientOptions): NotificasClient;
  embed(target: string | Element, options?: NotificasEmbedOptions): { destroy(): void; client: NotificasClient | null };
  autoEmbed(): void;
}

declare const Notificas: NotificasGlobal;
export default Notificas;
