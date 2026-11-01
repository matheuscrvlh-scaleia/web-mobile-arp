import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

// Carregamento: blocos lisos no formato e no lugar do conteúdo de verdade,
// com o brilho em onda (globals.css, .carregando). Cada tela monta o seu
// esqueleto espelhando o próprio layout.

/** Bloco de carregamento. Dê a altura/largura pelo className. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("carregando rounded-2xl", className)} />;
}

/** Área carregando: anuncia uma vez aos leitores de tela. */
export function LoadingRegion({
  children,
  label = "Carregando…",
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <output aria-busy="true" className={cn("flex flex-col gap-5", className)}>
      <span className="sr-only">{label}</span>
      {children}
    </output>
  );
}

/** Grade de cartões carregando (indicadores, lista em cartões). */
export function SkeletonGrid({
  count,
  className = "sm:grid-cols-2 xl:grid-cols-4",
  itemClassName = "h-36",
}: {
  count: number;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div aria-hidden className={cn("grid grid-cols-1 gap-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocos fixos, a posição é a identidade
        <div key={i} className={cn("carregando rounded-[1.75rem]", itemClassName)} />
      ))}
    </div>
  );
}

/** Tela inteira carregando (fallback genérico das rotas). */
export function PageSkeleton() {
  return (
    <LoadingRegion>
      <Skeleton className="h-12 w-72 rounded-full" />
      <Skeleton className="h-4 w-96 max-w-full rounded-full" />
      <SkeletonGrid count={4} />
      <Skeleton className="h-80 rounded-[1.75rem]" />
    </LoadingRegion>
  );
}
