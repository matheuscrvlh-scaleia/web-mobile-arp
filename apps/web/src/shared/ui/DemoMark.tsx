import { FlaskConical } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export const DEMO_HINT = "Dado fictício de demonstração: não existe de verdade.";
export const DEMO_MIXED_HINT =
  "Inclui dados fictícios de demonstração, gerados enquanto o app tem pouco uso.";

/**
 * Ícone de "dado fictício" ao lado de um nome, título ou número. Some quando
 * `show` é falso, então dá para usar direto: <DemoMark show={item.isDemo} />.
 */
export function DemoMark({
  show = true,
  hint = DEMO_HINT,
  className,
}: {
  show?: boolean;
  hint?: string;
  className?: string;
}) {
  if (!show) return null;
  return (
    <span
      role="img"
      aria-label={hint}
      title={hint}
      className={cn(
        "inline-grid size-5 shrink-0 cursor-help place-items-center rounded-full bg-amber-100 align-middle text-amber-800",
        className,
      )}
    >
      <FlaskConical className="size-3" aria-hidden />
    </span>
  );
}

/** Aviso de página: explica o ícone uma vez (topo do dashboard e das listas). */
export function DemoNotice({ show = true, className }: { show?: boolean; className?: string }) {
  if (!show) return null;
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900",
        className,
      )}
    >
      <DemoMark className="mt-px" hint={DEMO_MIXED_HINT} />
      <span>
        Os itens com este ícone são <strong>dados fictícios de demonstração</strong>, gerados
        enquanto o app tem pouco uso. Saem quando o banco for zerado.
      </span>
    </p>
  );
}
