import { colombiaCopy } from "@/lib/colombia-content";

export function CollectionControls() {
  const copy = colombiaCopy.controls;

  return (
    <section className="scroll-mt-24 px-4 py-16 sm:py-20 md:py-24">
      <div className="container">
        <h2 className="section-title mb-10 max-w-[20ch]">{copy.title}</h2>
        <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
          {copy.items.map((item) => (
            <li key={item.title} className="max-w-[36ch]">
              <h3 className="feature-title">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
