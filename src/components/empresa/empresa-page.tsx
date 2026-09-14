import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmpresaPage({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-5 p-5 lg:p-8", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          {typeof title === "string" ? <h1 className="app-page-title">{title}</h1> : title}
          {description ? (
            <div className="mt-1.5 max-w-xl text-[13px] leading-5 text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
