import { CONTENT_EDITOR, CONTENT_UPDATED_LABEL } from "@/lib/seo";

type ArticleHeaderProps = {
  title: string;
  lead: string;
  updatedLabel?: string;
  editor?: string;
};

export function ArticleHeader({
  title,
  lead,
  updatedLabel = CONTENT_UPDATED_LABEL,
  editor = CONTENT_EDITOR,
}: ArticleHeaderProps) {
  return (
    <header className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">
        Última actualización: {updatedLabel}
        <span aria-hidden> · </span>
        Responsable: {editor}
      </p>
      <p className="rounded-lg border border-border bg-muted/40 p-4 text-base leading-relaxed text-foreground">
        {lead}
      </p>
    </header>
  );
}
