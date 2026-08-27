export function LegalDisclaimer({ className }: { className?: string }) {
  return (
    <aside
      className={className}
      aria-label="Alcance jurídico de la información"
    >
      <p className="rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
        El valor probatorio y la suficiencia de cada medio de comunicación dependen del caso
        concreto, del contenido, de la normativa aplicable, de las formas que la ley o el contrato
        exijan, y de la valoración que corresponda. Hay situaciones en las que una norma o un
        contrato pueden exigir una forma determinada —por ejemplo, carta documento, notificación
        judicial u otra—. Notificas no pretende sustituir automáticamente esos requisitos ni
        garantiza un resultado jurídico.
      </p>
    </aside>
  );
}
