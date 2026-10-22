import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export function OperatorPlaceholder({ title, description }: { title: string; description: string }) {
 return <><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><Card><CardHeader><CardTitle>Coming soon</CardTitle></CardHeader><CardContent className="space-y-4"><PackageOpen aria-hidden="true" className="size-10 text-muted-foreground" /><p className="max-w-xl text-muted-foreground">{description}</p><Button asChild variant="outline"><Link href="/operator">Back to dashboard</Link></Button></CardContent></Card></>;
}
