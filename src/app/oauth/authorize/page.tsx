import { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { createPageMetadata } from "@/lib/seo";
import { AuthorizeClient } from "./authorize-client";

export const metadata: Metadata = createPageMetadata({
  title: "Conectar Notificas",
  description: "Autorizá a ChatGPT o Claude a usar Notificas con permisos limitados.",
  path: "/oauth/authorize",
  noIndex: true,
});

export default function OauthAuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AuthorizeClient />
    </Suspense>
  );
}
