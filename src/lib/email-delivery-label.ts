/** SMTP aceptó el mensaje. No es entrega en la casilla. */
export function emailDeliveryLabel(state: string | undefined): string {
  switch (String(state || "").toUpperCase()) {
    case "DELIVERED":
    case "SUCCESS":
      return "Aceptado por el servidor de correo";
    case "ERROR":
      return "Error de envío";
    case "PENDING":
      return "Pendiente";
    default:
      return state || "Pendiente";
  }
}
