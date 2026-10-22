import { Truck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12 sm:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-primary-foreground shadow-sm">
            <Truck aria-hidden="true" className="size-6" />
          </span>
          <span className="text-heading-3 font-bold tracking-tight text-foreground">
            SURFER<span className="text-brand">Track</span>
          </span>
        </div>
        <Card className="w-full">
          <CardHeader className="space-y-2">
            <CardTitle className="text-heading-2 font-bold tracking-tight">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
