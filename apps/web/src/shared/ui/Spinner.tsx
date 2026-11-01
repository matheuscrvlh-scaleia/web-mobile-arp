import { LoaderCircle } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      aria-hidden
      className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
    />
  );
}
