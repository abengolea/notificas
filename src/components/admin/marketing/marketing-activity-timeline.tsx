"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Phone, Mail, Users, MonitorPlay, MessageSquare, FileText,
  CheckCircle2, PlusCircle, AlertCircle, Bot, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Activity = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  actorType?: string;
  createdAt?: string | null;
};

const ICONS: Record<string, React.ElementType> = {
  call: Phone,
  meeting: Users,
  demo: MonitorPlay,
  email_sent: Mail,
  email_replied: MessageSquare,
  note_added: FileText,
  follow_up_created: PlusCircle,
  follow_up_completed: CheckCircle2,
  status_changed: AlertCircle,
  ai_event: Bot,
  system_event: Bot,
};

const ICON_COLORS: Record<string, string> = {
  call: "text-blue-500",
  meeting: "text-purple-500",
  demo: "text-violet-500",
  email_sent: "text-sky-500",
  email_replied: "text-emerald-500",
  note_added: "text-amber-500",
  follow_up_created: "text-orange-500",
  follow_up_completed: "text-green-600",
  status_changed: "text-indigo-500",
  ai_event: "text-pink-500",
  system_event: "text-muted-foreground",
};

function ActivityIcon({ type }: { type: string }) {
  const Icon = ICONS[type] ?? FileText;
  const color = ICON_COLORS[type] ?? "text-muted-foreground";
  return (
    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted", color)}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function relativeTime(ts: string | null | undefined): string {
  if (!ts) return "";
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: es });
  } catch {
    return "";
  }
}

type Props = {
  companyId?: string;
  contactId?: string;
  opportunityId?: string;
};

export function MarketingActivityTimeline({ companyId, contactId, opportunityId }: Props) {
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState<"note_added" | "call" | "meeting" | "demo">("note_added");
  const [saving, setSaving] = useState(false);

  const entityParam = companyId
    ? `companyId=${companyId}`
    : contactId
    ? `contactId=${contactId}`
    : opportunityId
    ? `opportunityId=${opportunityId}`
    : "";

  const load = useCallback(async () => {
    if (!entityParam) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/marketing/activities?${entityParam}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [entityParam]);

  useEffect(() => { load(); }, [load]);

  async function saveNote() {
    const text = noteText.trim();
    if (!text) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { type: noteType, title: text };
      if (companyId) body.companyId = companyId;
      if (contactId) body.contactId = contactId;
      if (opportunityId) body.opportunityId = opportunityId;
      const res = await fetch("/api/admin/marketing/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setNoteText("");
      setShowNote(false);
      await load();
    } catch {
      toast({ title: "Error al guardar la nota", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Actividad</h3>
        <Button variant="outline" size="sm" onClick={() => setShowNote((v) => !v)}>
          + Actividad
        </Button>
      </div>

      {showNote && (
        <div className="space-y-2 rounded-lg border bg-background p-3">
          <Select value={noteType} onValueChange={(v) => setNoteType(v as typeof noteType)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="call">Llamada</SelectItem>
              <SelectItem value="meeting">Reunión</SelectItem>
              <SelectItem value="demo">Demo</SelectItem>
              <SelectItem value="note_added">Nota</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            placeholder={noteType === "note_added" ? "Escribe una nota..." : "Resumen de la actividad..."}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            className="resize-none text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveNote} disabled={saving || !noteText.trim()}>
              {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Guardar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowNote(false); setNoteText(""); setNoteType("note_added"); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
      ) : (
        <ol className="space-y-1">
          {activities.map((act) => (
            <li key={act.id} className="flex gap-2.5">
              <div className="flex flex-col items-center pt-0.5">
                <ActivityIcon type={act.type} />
                <div className="mt-1 w-px flex-1 bg-border" />
              </div>
              <div className="pb-3 min-w-0">
                <p className="text-sm leading-snug">{act.title}</p>
                {act.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{act.description}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">{relativeTime(act.createdAt)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
