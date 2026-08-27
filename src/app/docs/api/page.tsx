"use client";

import { useEffect } from "react";

export default function PublicApiDocsPage() {
  useEffect(() => {
    const marker = document.createElement("script");
    marker.id = "api-reference";
    marker.setAttribute("data-url", "/openapi/v1.yaml");
    document.body.appendChild(marker);

    const src = document.createElement("script");
    src.src = "https://cdn.jsdelivr.net/npm/@scalar/api-reference";
    src.async = true;
    document.body.appendChild(src);

    return () => {
      marker.remove();
      src.remove();
    };
  }, []);

  return <div className="min-h-screen bg-background" />;
}
