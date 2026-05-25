export type User = {
  uid: string;
  email: string;
  tipo: 'individual' | 'empresa';
  estado: 'activo' | 'suspendido';
  perfil: {
    nombre: string;
    apellido?: string;
    razonSocial?: string;
    cuit?: string;
    direccion?: string;
    telefono?: string;
    verificado: boolean;
  };
  createdAt: Date;
  lastLogin: Date;
  avatarUrl?: string;
  creditos: number;
};

type BfaStamp = {
  stampId: string;
  timestamp: Date;
  receipt: object;
  hashRegistrado: string;
  verificacionUrl: string;
};

type BfaLeido = BfaStamp & {
  ipLector: string;
  dispositivoLector: string;
};

type BfaCertificado = BfaStamp & {
  certificadoPDF: string;
  hashCertificado: string;
};

export type Mensaje = {
  id: string;
  contenido: string;
  remitente: {
    uid: string;
    email: string;
    nombre: string;
  };
  destinatario: {
    uid: string;
    email: string;
    nombre: string;
  };
  timestamp: Date;
  hashSHA256: string;
  estadoEnvio: 'enviado' | 'recibido' | 'leido';
  bfaEnviado: BfaStamp;
  bfaLeido?: BfaLeido;
  bfaCertificado?: BfaCertificado;
  tokenLectura: string;
  linkLectura: string;
  prioridad: 'normal' | 'alta' | 'urgente';
  requiereCertificado: boolean;
};

// Admin Panel Types
export type AdminUser = {
    id: string;
    nombre: string;
    email: string;
    estado: 'activo' | 'suspendido';
    enviosDisponibles: number;
    fechaRegistro: Date;
};

export type AdminStats = {
    usuariosActivos: number;
    mensajesMes: number;
    ingresosEstimados: number;
};

export type Plan = {
    id: string;
    nombre: string;
    descripcion: string;
    precio: number;
    creditos?: number;
    type: 'unitario' | 'pack' | 'suscripcion';
    activo?: boolean;
    orden?: number;
};

export type Transaccion = {
    id: string;
    fecha: Date;
    tipo: 'compra' | 'uso';
    descripcion: string;
    monto: number;
    creditos: number;
    metodoPago?: 'Mercado Pago' | 'Crédito' | 'Envíos';
};

export type Contacto = {
    id: string;
    email: string;
    nombre?: string;
    cuit?: string; // CUIT opcional
    telefono?: string; // Teléfono para WhatsApp
    usuarioId: string; // ID del usuario que tiene este contacto
    ultimoUso: Date;
    vecesUsado: number;
    createdAt: Date;
};

// —— Módulo B2B Empresas ——
export interface Organization {
  id: string;
  nombre: string;
  cuit: string;
  tipo: 'empresa' | 'estudio_juridico' | 'consumidores' | 'otro';
  adminUserId: string;
  /** Denormalizado (alta vía admin) para listados en panel. */
  adminUserEmail?: string;
  members: string[];
  plan: 'starter' | 'business' | 'enterprise';
  logoUrl?: string;
  createdAt: unknown;
}

export interface RecipientEntry {
  email: string;
  nombre: string;
  dni?: string;
  legajo?: string;
  telefono?: string;
  area?: string;
}

export interface RecipientList {
  id: string;
  orgId: string;
  nombre: string;
  recipients: RecipientEntry[];
  count: number;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface CampaignAttachment {
  nombre: string;
  url: string;
  hash: string;
  size: number;
}

export interface Campaign {
  id: string;
  orgId: string;
  createdBy: string;
  nombre: string;
  asunto: string;
  cuerpo: string;
  adjuntos: CampaignAttachment[];
  /** Adjuntos sólo para ese correo (keys en minúsculas). Compatible con adjuntos globales. */
  adjuntosPorDestinatario?: Record<string, CampaignAttachment[]>;
  recipientListId?: string;
  recipientEmails: string[];
  recipientData: RecipientEntry[];
  recipientCount: number;
  estado: 'borrador' | 'enviando' | 'completada' | 'cancelada';
  stats: {
    total: number;
    enviados: number;
    leidos: number;
    pendientes: number;
    errores: number;
  };
  createdAt: unknown;
  scheduledAt?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
}

export interface CampaignMessage {
  id: string;
  campaignId: string;
  orgId: string;
  mailId: string;
  recipientEmail: string;
  recipientNombre: string;
  recipientDni?: string;
  recipientLegajo?: string;
  estado: 'pendiente' | 'enviado' | 'leido' | 'error';
  enviadoAt?: unknown;
  leidoAt?: unknown;
  txHashEnvio?: string;
  txHashLectura?: string;
  errorMsg?: string;
}