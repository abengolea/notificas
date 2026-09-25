import type { BocaEnvio } from "@/lib/types";

export type EmpresaEquipoMember = {
  uid: string;
  email: string;
  nombre: string;
  telefono: string;
  estado: "activo" | "suspendido";
  enviosDisponibles: number;
  mustSetPassword: boolean;
  lastLoginAt: string | null;
  isOrgAdmin: boolean;
  bocaId: string | null;
  bocaNombre: string | null;
  campanasCount: number;
  enviosIndividualesCount: number;
  enviadosTotal: number;
};

export type EmpresaEquipoPayload = {
  orgId: string;
  orgNombre: string;
  isAdmin: boolean;
  bocas: BocaEnvio[];
  members: EmpresaEquipoMember[];
  adminEnviosDisponibles: number;
};
