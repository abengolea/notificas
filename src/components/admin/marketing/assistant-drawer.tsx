"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// ─── Context ────────────────────────────────────────────────────────────────

type DrawerCtx = { open: () => void; close: () => void; toggle: () => void };
const Ctx = createContext<DrawerCtx>({ open: () => {}, close: () => {}, toggle: () => {} });
export function useAssistantDrawer() {
  return useContext(Ctx);
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Action = { tool: string; summary: string; write?: boolean };
type ChatItem = { role: "user" | "assistant"; content: string; actions?: Action[] };

// ─── Chat inner component ─────────────────────────────────────────────────────

function AssistantChat() {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [busy, setBusy] = useState<"idle" | "consulting" | "writing">("idle");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 px-4 py-3">
        {items.length === 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-sm text-muted-foreground font-medium">Ejemplos:</p>
            {[
              "¿Qué empresas tenemos en Uruguay?",
              "¿Cuántas tareas vencen esta semana?",
              "Creame una tarea para seguir a Naturgy en 7 días.",
              "¿Quién respondió a la última campaña?",
            ].map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setInput(ex);
                  setTimeout(() => textareaRef.current?.focus(), 50);
                }}
                className="block w-full text-left rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
        {items.map((item, idx) => (
          <div key={idx} className={item.role === "user" ? "ml-6" : "mr-6"}>
            <div
              className={
                item.role === "user"
                  ? "rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "rounded-xl border border-border bg-background px-3 py-2 text-sm whitespace-pre-wrap"
              }
            >
              {item.content}
            </div>
            {item.actions && item.actions.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground pl-1">
                {item.actions.map((action, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <span className={action.write ? "text-amber-500" : "text-blue-500"}>
                      {action.write ? "↑" : "↓"}
                    </span>
                    {action.summary}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {busy === "consulting" && (
          <div className="mr-6 rounded-xl border border-border bg-background px-3 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {busy === "writing" && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 pl-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Ejecutando acción…
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="px-4 pb-1 text-xs text-destructive">{error}</p>
      )}

      {/* Input */}
      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribí una instrucción…"
          className="min-h-[56px] max-h-32 resize-none text-sm"
          disabled={busy !== "idle"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button
          type="submit"
          size="sm"
          disabled={busy !== "idle" || !input.trim()}
          className="shrink-0"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}

// ─── Provider + Drawer ────────────────────────────────────────────────────────

export function AssistantDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        // Don't hijack if an input is focused (unless it's our own textarea)
        const active = document.activeElement;
        const isOwnTextarea = active instanceof HTMLTextAreaElement && active.closest("[data-assistant-drawer]");
        if (isOwnTextarea) return;
        const isTyping =
          active instanceof HTMLInputElement ||
          (active instanceof HTMLTextAreaElement && !isOwnTextarea) ||
          (active instanceof HTMLElement && active.isContentEditable);
        if (isTyping) return;
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <Ctx.Provider value={{ open, close, toggle }}>
      {children}

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-full sm:w-[420px] p-0 flex flex-col"
          data-assistant-drawer=""
        >
          <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Asistente IA
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0">
            <AssistantChat />
          </div>
        </SheetContent>
      </Sheet>

      {/* Floating trigger — visible on all marketing pages */}
      {!isOpen && (
        <button
          type="button"
          onClick={toggle}
          title="Asistente IA (⌘K)"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Asistente</span>
          <kbd className="hidden sm:inline ml-1 rounded bg-white/20 px-1.5 py-0.5 text-xs font-mono">⌘K</kbd>
        </button>
      )}
    </Ctx.Provider>
  );
}
