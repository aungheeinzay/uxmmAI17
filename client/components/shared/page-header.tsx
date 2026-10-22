import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6", className)}>
      <div className="space-y-1.5">
        {eyebrow ? (
          <p className="text-body-sm font-semibold uppercase tracking-[0.08em] text-brand">{eyebrow}</p>
        ) : null}
        <h1 className="text-heading-1 font-bold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-body-md text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
