import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/shared/lib/cn";
import { iconFor } from "@/shared/lib/icons";

// Ícones pelo nome do banco: ficam fora de misc.tsx para que só as telas
// que desenham ícones por nome carreguem o mapa curado do lucide.

/**
 * Ícone do lucide (pelo nome do banco) sobre uma cor: loja, categoria,
 * ponto do mapa. A cor é fixa (não inverte no escuro), o ícone é branco.
 */
export function IconTile({
  icon,
  color,
  size = "md",
  className,
  style,
}: {
  icon: string | LucideIcon;
  /** #RRGGBB; sem cor, usa a tinta do app. */
  color?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: CSSProperties;
}) {
  const Icon = typeof icon === "string" ? iconFor(icon) : icon;
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center text-[#fff]",
        size === "sm" && "size-8 rounded-xl",
        size === "md" && "size-10 rounded-2xl",
        size === "lg" && "size-14 rounded-[1.25rem]",
        className,
      )}
      // Fundo próprio (ex.: degradê do selo) dispensa a cor sólida.
      style={style?.background ? style : { backgroundColor: color ?? "#141714", ...style }}
    >
      <Icon className={size === "lg" ? "size-6" : size === "md" ? "size-[18px]" : "size-4"} />
    </span>
  );
}

/** Selo do app: ícone sobre o degradê do selo (gradientFrom → gradientTo). */
export function SealIcon({
  icon,
  from,
  to,
  size = "md",
}: {
  icon: string;
  from: string;
  to: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <IconTile
      icon={icon}
      size={size}
      className="rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    />
  );
}
