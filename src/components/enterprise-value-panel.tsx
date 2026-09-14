import { FileCheck2, MessagesSquare, Route } from "lucide-react";

const TRACK = ["Enviado", "Entregado", "Leído", "Certificado"] as const;

const POINTS = [
  {
    icon: Route,
    title: "Trazabilidad individual",
    body: "Cada envío registra su propio estado.",
  },
  {
    icon: MessagesSquare,
    title: "Multicanal",
    body: "WhatsApp, email o ambos.",
  },
  {
    icon: FileCheck2,
    title: "Certificado verificable",
    body: "PDF individual y verificación pública.",
  },
] as const;

export function EnterpriseValuePanel() {
  return (
    <aside className="flex h-full flex-col p-6 sm:p-8">
      <h3 className="font-headline text-xl font-bold leading-snug tracking-[-0.025em] text-foreground">
        Campañas corporativas con evidencia por destinatario
      </h3>
      <p className="mt-3 max-w-[46ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
        Definís el volumen y el canal. Cada destinatario deja rastro propio: envío, entrega o lectura cuando el canal lo informa, y un PDF que se puede verificar.
      </p>

      <ol className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
        {TRACK.map((step, index) => (
          <li key={step} className="flex items-center gap-2">
            {index > 0 ? (
              <span className="h-px w-5 bg-border dark:bg-white/20" aria-hidden />
            ) : null}
            <span className="font-medium text-foreground">{step}</span>
          </li>
        ))}
      </ol>

      <ul className="mt-8 space-y-5">
        {POINTS.map((point) => (
          <li key={point.title} className="flex gap-3">
            <point.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="feature-title">{point.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-auto border-t border-border pt-6 dark:border-white/10">
        <p className="text-sm leading-relaxed text-foreground">
          Ideal para mora, cobranzas, intimaciones, avisos masivos y comunicaciones
          operativas.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Respuesta comercial rápida. Cotización a medida. Atención para campañas de
          alto volumen.
        </p>
      </div>
    </aside>
  );
}
