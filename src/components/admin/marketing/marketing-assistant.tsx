"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { MarketingSubnav } from "./marketing-subnav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Action = {
  tool: string;
  summary: string;
  write?: boolean;
};

type ChatItem = {
  role: "user" | "assistant";
  content: string;
  actions?: Action[];
};

type Status = { enabled: boolean; configured: boolean; model: string };

export function MarketingAssistant() {
  const [status, setStatus] = useState<Status | null>(null);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [busy, setBusy] = useState<"idle" | "consulting" | "writing">("idle");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/marketing/ai/status", { credentials: "include" });
      const body = await res.json();
      if (!cancelled) setStatus(body);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, busy]);

  async function send() {
    const message = input.trim();
    if (!message || busy !== "idle") return;
    setError(null);
    setInput("");
    setItems((prev) => [...prev, { role: "user", content: message }]);
    setBusy("consulting");
    try {
      const res = await fetch("/api/admin/marketing/ai/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "No se pudo consultar el asistente");
      setConversationId(body.conversationId);
      const actions: Action[] = Array.isArray(body.actions) ? body.actions : [];
      if (actions.some((a) => a.write)) setBusy("writing");
      setItems((prev) => [
        ...prev,
        { role: "assistant", content: String(body.message || ""), actions },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy("idle");
    }
  }

  const blocked = status && (!status.enabled || !status.configured);

  return (
    <div className="space-y-4">
      <MarketingSubnav />
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h1 className="text-lg font-semibold">Asistente IA</h1>
          <p className="text-sm text-muted-foreground">
            Consultá y operá el CRM en lenguaje natural. El CRM es la fuente de verdad.
          </p>
        </div>
        {blocked ? (
          <div className="px-4 py-10 text-sm text-muted-foreground">
            Asistente IA no configurado. Activá <code>CRM_AI</code> y <code>GEMINI_API_KEY</code> en el servidor.
          </div>
        ) : (
          <>
            <div className="max-h-[60vh] min-h-[280px] space-y-3 overflow-y-auto px-4 py-4">
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Ejemplos: «¿Qué empresas tenemos en Uruguay?» · «Creame una tarea para volver a contactar a Naturgy en 7 días.»
                </p>
              )}
              {items.map((item, idx) => (
                <div key={idx} className={item.role === "user" ? "ml-8" : "mr-8"}>
                  <div
                    className={
                      item.role === "user"
                        ? "rounded-md bg-muted px-3 py-2 text-sm"
                        : "rounded-md border border-border px-3 py-2 text-sm whitespace-pre-wrap"
                    }
                  >
                    {item.content}
                  </div>
                  {item.actions && item.actions.length > 0 && (
                    <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                      {item.actions.map((action, i) => (
                        <li key={i}>
                          {action.write ? "Acción: " : "Consulta: "}
                          {action.summary}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {busy === "consulting" && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Consultando CRM…
                </p>
              )}
              {busy === "writing" && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Ejecutando acción…
                </p>
              )}
              <div ref={bottomRef} />
            </div>
            {error && <p className="px-4 text-sm text-destructive">{error}</p>}
            <form
              className="flex items-end gap-2 border-t border-border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribí una instrucción…"
                className="min-h-[64px]"
                disabled={busy !== "idle"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button type="submit" disabled={busy !== "idle" || !input.trim()}>
                <Send className="h-4 w-4" />
                Enviar
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
