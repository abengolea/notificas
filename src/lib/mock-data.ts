import type { User, Mensaje, Plan, AdminStats, AdminUser } from './types';

export const mockUser: User = {
  uid: 'user-123',
  email: 'legal.rep@examplecorp.com',
  tipo: 'empresa',
  perfil: {
    nombre: 'ExampleCorp S.A.',
    razonSocial: 'ExampleCorp S.A.',
    cuit: '30-12345678-9',
    verificado: true,
    telefono: '+54 9 11 1234-5678',
  },
  createdAt: new Date('2023-01-15T09:00:00Z'),
  lastLogin: new Date(),
  avatarUrl: 'https://placehold.co/100x100.png',
};

export const mockMessages: Mensaje[] = [
  {
    id: 'msg-001',
    contenido: 'Este es un aviso legal importante sobre el contrato N° 5523. Por favor, revise los términos y condiciones adjuntos y acuse recibo a la brevedad. El no hacerlo puede resultar en la terminación del acuerdo.',
    remitente: { uid: 'user-456', email: 'juan.perez@individual.com', nombre: 'Juan Pérez' },
    destinatario: { uid: 'user-123', email: 'legal.rep@examplecorp.com', nombre: 'ExampleCorp S.A.' },
    timestamp: new Date('2024-07-29T10:00:00Z'),
    hashSHA256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    estadoEnvio: 'leido',
    bfaEnviado: {
      stampId: 'bfa-stamp-enviado-001',
      timestamp: new Date('2024-07-29T10:00:05Z'),
      receipt: {},
      hashRegistrado: 'hash-enviado-001',
      verificacionUrl: 'https://bfa.ar/verify/bfa-stamp-enviado-001',
    },
    bfaLeido: {
      stampId: 'bfa-stamp-leido-001',
      timestamp: new Date('2024-07-29T11:30:15Z'),
      receipt: {},
      hashRegistrado: 'hash-leido-001',
      ipLector: '192.168.1.100',
      dispositivoLector: 'Chrome on macOS',
      verificacionUrl: 'https://bfa.ar/verify/bfa-stamp-leido-001',
    },
    bfaCertificado: {
      stampId: 'bfa-stamp-cert-001',
      timestamp: new Date('2024-07-29T14:00:00Z'),
      receipt: {},
      certificadoPDF: '/path/to/certificado-001.pdf',
      hashCertificado: 'hash-certificado-001',
      verificacionUrl: 'https://bfa.ar/verify/bfa-stamp-cert-001',
    },
    tokenLectura: 'token-001',
    linkLectura: '/read/token-001',
    prioridad: 'urgente',
    requiereCertificado: true,
  },
  {
    id: 'msg-002',
    contenido: 'Le recordamos que la factura con vencimiento el 30/07/2024 se encuentra impaga. Adjuntamos copia de la misma para su conveniencia. Por favor, regularice su situación para evitar la suspensión del servicio.',
    remitente: { uid: 'user-789', email: 'administracion@proveedor.com', nombre: 'Servicios Digitales SRL' },
    destinatario: { uid: 'user-123', email: 'legal.rep@examplecorp.com', nombre: 'ExampleCorp S.A.' },
    timestamp: new Date('2024-07-28T15:20:00Z'),
    hashSHA256: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
    estadoEnvio: 'recibido',
    bfaEnviado: {
      stampId: 'bfa-stamp-enviado-002',
      timestamp: new Date('2024-07-28T15:20:05Z'),
      receipt: {},
      hashRegistrado: 'hash-enviado-002',
      verificacionUrl: 'https://bfa.ar/verify/bfa-stamp-enviado-002',
    },
    tokenLectura: 'token-002',
    linkLectura: '/read/token-002',
    prioridad: 'alta',
    requiereCertificado: true,
  },
  {
    id: 'msg-003',
    contenido: 'Confirmación de reunión para el día viernes 02/08/2024 a las 11:00 AM en nuestras oficinas para discutir la propuesta de expansión. Esperamos su presencia.',
    remitente: { uid: 'user-101', email: 'asistente@socio.com', nombre: 'Asistente de Socio' },
    destinatario: { uid: 'user-123', email: 'legal.rep@examplecorp.com', nombre: 'ExampleCorp S.A.' },
    timestamp: new Date('2024-07-27T09:05:00Z'),
    hashSHA256: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    estadoEnvio: 'enviado',
    bfaEnviado: {
      stampId: 'bfa-stamp-enviado-003',
      timestamp: new Date('2024-07-27T09:05:05Z'),
      receipt: {},
      hashRegistrado: 'hash-enviado-003',
      verificacionUrl: 'https://bfa.ar/verify/bfa-stamp-enviado-003',
    },
    tokenLectura: 'token-003',
    linkLectura: '/read/token-003',
    prioridad: 'normal',
    requiereCertificado: false,
  },
];

export const mockAdminUsers: AdminUser[] = [
    {
      id: 'user-123',
      nombre: 'ExampleCorp S.A.',
      email: 'legal.rep@examplecorp.com',
      estado: 'activo',
      enviosDisponibles: 15,
      fechaRegistro: new Date('2023-01-15T09:00:00Z'),
    },
    {
      id: 'user-456',
      nombre: 'Juan Pérez',
      email: 'juan.perez@individual.com',
      estado: 'activo',
      enviosDisponibles: 5,
      fechaRegistro: new Date('2023-03-22T14:30:00Z'),
    },
    {
      id: 'user-789',
      nombre: 'Servicios Digitales SRL',
      email: 'administracion@proveedor.com',
      estado: 'suspendido',
      enviosDisponibles: 0,
      fechaRegistro: new Date('2023-05-10T18:00:00Z'),
    },
    {
      id: 'user-101',
      nombre: 'Estudio Jurídico & Asoc.',
      email: 'contacto@juridico.com',
      estado: 'activo',
      enviosDisponibles: 150,
      fechaRegistro: new Date('2023-02-01T11:00:00Z'),
    },
     {
      id: 'user-112',
      nombre: 'María Gonzalez',
      email: 'maria.g@personal.com',
      estado: 'activo',
      enviosDisponibles: 2,
      fechaRegistro: new Date('2024-06-18T10:20:00Z'),
    }
  ];
  
  export const mockAdminStats: AdminStats = {
    usuariosActivos: mockAdminUsers.filter(u => u.estado === 'activo').length,
    mensajesMes: 1250,
    ingresosEstimados: 18500.50,
  };
  
  export const mockPlanes: Plan[] = [
      {
          id: 'individual',
          nombre: 'Envío Individual',
          descripcion: 'Ideal para notificaciones puntuales.',
          precio: 5.00,
          type: 'unitario'
      },
      {
          id: 'pack10',
          nombre: 'Pack de 10 Envíos',
          descripcion: 'Ahorra con nuestro pack de 10 envíos.',
          precio: 45.00,
          type: 'pack'
      },
      {
          id: 'ilimitado',
          nombre: 'Plan Mensual Ilimitado',
          descripcion: 'Envía todo lo que necesites por un precio fijo.',
          precio: 300.00,
          type: 'suscripcion'
      }
  ];
