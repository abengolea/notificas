"use client";

import { useEffect } from "react";
import Link from "next/link";

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

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed left-3 top-3 z-[100]">
        <Link
          href="/admin/api-keys"
          className="rounded-md border bg-background/95 px-3 py-1.5 text-sm shadow-sm hover:bg-muted"
        >
          ← API Keys
        </Link>
      </div>
    </div>
  );
}
