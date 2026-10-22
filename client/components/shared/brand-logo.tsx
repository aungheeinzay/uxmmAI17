import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/surfertrack-icon.svg"
      alt=""
      aria-hidden="true"
      width={1280}
      height={963}
      priority={priority}
      unoptimized
      className={cn("h-10 w-auto object-contain", className)}
    />
  );
}
