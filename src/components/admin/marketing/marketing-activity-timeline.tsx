"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Phone, Mail, Users, MonitorPlay, MessageSquare, FileText,
  CheckCircle2, PlusCircle, AlertCircle, Bot, Loader2, Linkedin,
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
  linkedin_connection_sent: Linkedin,
  linkedin_connected: Linkedin,
  linkedin_message_sent: Linkedin,
  linkedin_follow_up_sent: Linkedin,
  linkedin_replied: Linkedin,
  linkedin_interested: Linkedin,
  linkedin_not_interested: Linkedin,
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
  linkedin_connection_sent: "text-sky-600",
  linkedin_connected: "text-blue-600",
  linkedin_message_sent: "text-indigo-600",
  linkedin_follow_up_sent: "text-violet-600",
  linkedin_replied: "text-emerald-600",
  linkedin_interested: "text-green-700",
  linkedin_not_interested: "text-muted-foreground",
};

const LINKEDIN_TYPES = new Set([
  "linkedin_connection_sent",
  "linkedin_connected",
  "linkedin_message_sent",
  "linkedin_follow_up_sent",
  "linkedin_replied",
  "linkedin_interested",
  "linkedin_not_interested",
]);

const EMAIL_TYPES = new Set([
  "email_sent",
  "email_delivered",
  "email_opened",
  "email_clicked",
  "email_replied",
]);

const LINKEDIN_ACTIVITY_LABEL: Record<string, string> = {
  linkedin_connection_sent: "Solicitud de conexión enviada",
  linkedin_connected: "Conexión aceptada",
  linkedin_message_sent: "Mensaje de LinkedIn enviado",
  linkedin_follow_up_sent: "Seguimiento de LinkedIn enviado",
  linkedin_replied: "Respondió por LinkedIn",
  linkedin_interested: "Interesado por LinkedIn",
  linkedin_not_interested: "No interesado por LinkedIn",
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

  const activityGroup = (title: string, rows: Activity[]) => (
    <section className="space-y-2" aria-label={title}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin actividad registrada.</p>
      ) : (
        <ol className="space-y-1">
          {rows.map((act) => (
            <li key={act.id} className="flex gap-2.5">
              <div className="flex flex-col items-center pt-0.5">
                <ActivityIcon type={act.type} />
                <div className="mt-1 w-px flex-1 bg-border" />
              </div>
              <div className="min-w-0 pb-3">
                <p className="text-sm leading-snug">{LINKEDIN_ACTIVITY_LABEL[act.type] || act.title}</p>
                {act.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{act.description}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">{relativeTime(act.createdAt)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Actividad comercial</h3>
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
        <div className="space-y-5">
          {activityGroup("LinkedIn", activities.filter((activity) => LINKEDIN_TYPES.has(activity.type)))}
          {activityGroup("Email", activities.filter((activity) => EMAIL_TYPES.has(activity.type)))}
          {activityGroup(
            "Otras actividades",
            activities.filter(
              (activity) => !LINKEDIN_TYPES.has(activity.type) && !EMAIL_TYPES.has(activity.type),
            ),
          )}
        </div>
      )}
    </div>
  );
}
