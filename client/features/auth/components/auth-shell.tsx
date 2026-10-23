import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

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
          <Image
                            src="/images/logo.png"
                            alt="SURFERTrack"
                            width={1280}
                            height={295}
                            sizes="224px"
                            className="h-auto w-full"
                          />
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
