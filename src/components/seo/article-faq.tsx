type FaqItem = {
  question: string;
  answer: string;
};

export function ArticleFaq({ items }: { items: readonly FaqItem[] }) {
  if (!items.length) return null;

  return (
    <section className="space-y-4" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="pt-2 text-xl font-semibold text-foreground">
        Preguntas frecuentes
      </h2>
      <div className="space-y-3">
        {items.map((item) => (
          <details
            key={item.question}
            className="rounded-lg border border-border bg-background/60 px-4 py-3"
          >
            <summary className="cursor-pointer text-sm font-medium text-foreground sm:text-base">
              {item.question}
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
