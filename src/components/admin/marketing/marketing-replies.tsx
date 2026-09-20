"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, isToday, isThisWeek, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { MessageSquare, ExternalLink, Plus, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { MarketingSubnav } from "./marketing-subnav";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Reply = {
  id: string;
  email?: string;
  name?: string;
  company?: string;
  campaignId?: string;
  contactId?: string;
  companyId?: string;
  repliedAt?: string | null;
  replySnippet?: string | null;
  gmailThreadId?: string | null;
  subject?: string;
};

function relativeTime(ts: string | null | undefined): string {
  if (!ts) return "";
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: es });
  } catch {
    return "";
  }
}

function groupReplies(replies: Reply[]): Array<{ label: string; items: Reply[] }> {
  const today: Reply[] = [];
  const week: Reply[] = [];
  const older: Reply[] = [];
  for (const r of replies) {
    if (!r.repliedAt) { older.push(r); continue; }
    const d = parseISO(r.repliedAt);
    if (isToday(d)) today.push(r);
    else if (isThisWeek(d, { weekStartsOn: 1 })) week.push(r);
    else older.push(r);
  }
  const groups = [];
  if (today.length) groups.push({ label: "Hoy", items: today });
  if (week.length) groups.push({ label: "Esta semana", items: week });
  if (older.length) groups.push({ label: "Antes", items: older });
  return groups;
}

const TASK_TYPES = [
  ["follow_up", "Follow-up"],
  ["call", "Llamada"],
  ["email", "Email"],
  ["meeting", "Reunión"],
  ["demo", "Demo"],
  ["proposal", "Propuesta"],
  ["other", "Otro"],
] as const;

function QuickTaskForm({
  reply,
  onDone,
}: {
  reply: Reply;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(
    `Responder a ${reply.name || reply.email || "contacto"}`
  );
  const [taskType, setTaskType] = useState("follow_up");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        taskType,
        priority: "normal",
        status: "open",
      };
      if (reply.contactId) body.contactId = reply.contactId;
      if (reply.companyId) body.companyId = reply.companyId;
      if (dueAt) body.dueAt = new Date(dueAt).toISOString();
      const res = await fetch("/api/admin/marketing/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Tarea creada" });
      onDone();
    } catch {
      toast({ title: "Error al crear tarea", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 flex flex-wrap items-end gap-2 rounded-md bg-muted/40 px-3 py-2.5">
      <div className="flex-1 min-w-[180px] space-y-0.5">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Tarea</label>
        <Input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-7 text-xs"
          required
        />
      </div>
      <div className="w-32 space-y-0.5">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Tipo</label>
        <Select value={taskType} onValueChange={setTaskType}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TASK_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="w-36 space-y-0.5">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Vence</label>
        <Input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="h-7 text-xs"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={saving || !title.trim()}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Crear"}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function ReplyItem({ reply }: { reply: Reply }) {
  const [showTask, setShowTask] = useState(false);
  return (
    <li className="px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
        <div className="shrink-0 mt-0.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
            <MessageSquare className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {reply.name || reply.email || "Sin nombre"}
              </span>
              {reply.email && reply.name && (
                <span className="text-xs text-muted-foreground">{reply.email}</span>
              )}
              {reply.company && (
                <span className="text-xs text-muted-foreground">· {reply.company}</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{relativeTime(reply.repliedAt)}</span>
          </div>
          {reply.subject && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Asunto: <span className="font-medium text-foreground">{reply.subject}</span>
            </p>
          )}
          {reply.replySnippet && (
            <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2 italic">
              &ldquo;{reply.replySnippet}&rdquo;
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {reply.campaignId && (
              <Link href={`/admin/marketing/campanas/${reply.campaignId}`} className="hover:underline hover:text-foreground">
                ver campaña
              </Link>
            )}
            {reply.contactId && (
              <Link href={`/admin/marketing/contactos/${reply.contactId}`} className="hover:underline hover:text-foreground">
                ver contacto
              </Link>
            )}
            {reply.companyId && (
              <Link href={`/admin/marketing/empresas/${reply.companyId}`} className="hover:underline hover:text-foreground">
                ver empresa
              </Link>
            )}
            {reply.gmailThreadId && (
              <a
                href={`https://mail.google.com/mail/u/0/#inbox/${reply.gmailThreadId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 hover:underline hover:text-foreground"
              >
                Gmail <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setShowTask((v) => !v)}
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              {showTask
                ? <><ChevronUp className="h-3 w-3" /> Cancelar tarea</>
                : <><Plus className="h-3 w-3" /> Crear tarea</>
              }
            </button>
          </div>
          {showTask && (
            <QuickTaskForm reply={reply} onDone={() => setShowTask(false)} />
          )}
        </div>
      </div>
    </li>
  );
}

export function MarketingReplies() {
  const { toast } = useToast();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/marketing/replies?limit=100");
        if (res.ok) {
          const data = await res.json();
          setReplies(data.replies ?? []);
        }
      } catch {
        toast({ title: "Error al cargar respuestas", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const groups = groupReplies(replies);

  return (
    <div className="space-y-6">
      <MarketingSubnav />

      <div className="flex items-center gap-3">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Respuestas</h1>
        {replies.length > 0 && (
          <Badge variant="secondary">{replies.length}</Badge>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : replies.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <MessageSquare className="h-8 w-8 opacity-40" />
          <p className="text-sm">Todavía no hay respuestas a campañas.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.label}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{group.items.length}</Badge>
              </div>
              <ul className="divide-y rounded-lg border bg-background">
                {group.items.map((reply) => (
                  <ReplyItem key={reply.id} reply={reply} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
