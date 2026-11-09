export function LegalDisclaimer({ className }: { className?: string }) {
  return (
    <aside
      className={className}
      aria-label="Alcance jurídico de la información"
    >
      <p className="rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
        La valoración jurídica de cada comunicación y de la evidencia que genera corresponde al
        juez o al organismo, según el caso.
      </p>
    </aside>
  );
}
