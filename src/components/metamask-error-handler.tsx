"use client";

import { useEffect } from "react";

/**
 * Notificas NO usa MetaMask. Este componente ignora errores de conexión
 * que MetaMask (inyectado en todas las páginas) puede lanzar cuando está
 * bloqueado o el usuario rechazó la conexión.
 */
export function MetaMaskErrorHandler() {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const msg = event?.reason?.message ?? String(event?.reason ?? "");
      if (
        typeof msg === "string" &&
        (msg.includes("Failed to connect to MetaMask") ||
          msg.includes("User denied") ||
          /ethereum|metamask/i.test(msg))
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return null;
}
