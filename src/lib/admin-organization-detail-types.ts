export type AdminOrgMember = {
  uid: string;
  email: string;
  nombre: string;
  telefono: string;
  estado: "activo" | "suspendido";
  enviosDisponibles: number;
  mustSetPassword: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  isOrgAdmin: boolean;
};

export type AdminOrgContact = {
  email: string;
  nombre: string;
  telefono: string;
  lista: string;
};

export type AdminOrganizationDetail = {
  id: string;
  nombre: string;
  cuit: string;
  tipo: string;
  plan: string;
  logoUrl: string | null;
  adminUserId: string;
  adminUserEmail: string;
  members: string[];
  isTestOrganization: boolean;
  environment: string | null;
  createdAt: string | null;
  campaignCount: number;
  listCount: number;
  recipientCount: number;
  operators: AdminOrgMember[];
  contacts: AdminOrgContact[];
  contactsTruncated: boolean;
};
