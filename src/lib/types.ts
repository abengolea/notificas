export type User = {
  uid: string;
  email: string;
  tipo: 'individual' | 'empresa';
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
