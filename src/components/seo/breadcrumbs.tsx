import Link from "next/link";

import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  name: string;
  path?: string;
};

export function Breadcrumbs({ items }: { items: readonly BreadcrumbItem[] }) {
  return (
    <nav aria-label="Miga de pan" className="mb-6 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.name}-${index}`} className="flex items-center gap-x-1">
              {index > 0 ? <span aria-hidden> / </span> : null}
              {last || !item.path ? (
                <span className="text-foreground" aria-current={last ? "page" : undefined}>
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.path}
                  className={cn("text-primary underline-offset-4 hover:underline")}
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
