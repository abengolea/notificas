import Link from "next/link";

import type { PublicResource } from "@/lib/public-resources";
import { RESOURCE_HUB, relatedResources } from "@/lib/public-resources";

export function RelatedResources({
  currentPath,
  items,
}: {
  currentPath: string;
  items?: readonly PublicResource[];
}) {
  const related = items ?? relatedResources(currentPath);

  return (
    <section className="border-t pt-8" aria-labelledby="related-heading">
      <h2 id="related-heading" className="mb-3 text-lg font-semibold">
        Recursos relacionados
      </h2>
      <ul className="space-y-2 text-sm">
        {related.map((page) => (
          <li key={page.path}>
            <Link href={page.path} className="text-primary underline-offset-4 hover:underline">
              {page.title}
            </Link>
            <span className="text-muted-foreground"> — {page.blurb}</span>
          </li>
        ))}
        <li>
          <Link
            href={RESOURCE_HUB.path}
            className="text-primary underline-offset-4 hover:underline"
          >
            Ver todos los recursos
          </Link>
        </li>
      </ul>
    </section>
  );
}
