export const RECLAMO_ESTADOS = ["nuevo", "en_proceso", "resuelto", "cerrado"] as const;

export type ReclamoEstado = (typeof RECLAMO_ESTADOS)[number];

export type Reclamo = {
  id: string;
  ticketNumber: string;
  nombre: string;
  email: string;
  telefono?: string;
  mensaje: string;
  estado: ReclamoEstado;
  adminNotas?: string;
  createdAt?: string;
  updatedAt?: string;
};

export function formatTicketNumber(docId: string): string {
  return `REC-${docId.slice(0, 8).toUpperCase()}`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function reclamoEstadoLabel(estado: ReclamoEstado): string {
  switch (estado) {
    case "nuevo":
      return "Nuevo";
    case "en_proceso":
      return "En proceso";
    case "resuelto":
      return "Resuelto";
    case "cerrado":
      return "Cerrado";
  }
}
