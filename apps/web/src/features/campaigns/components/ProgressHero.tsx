import { CalendarDays, Check, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { plural } from "@/shared/lib/format";
import { iconFor } from "@/shared/lib/icons";

export interface HeroTier {
  threshold: number;
  label: string;
  icon: string;
}

/**
 * O cartão de progresso da tela de Selos do app (qhero): selos juntados,
 * barra verde "n/N" e as faixas de benefício, com check nas alcançadas.
 * Cores fixas (é o app, não o painel): igual nos dois temas.
 */
export function ProgressHero({
  title,
  daysLeft,
  tiers,
  max,
  value,
}: {
  title: string;
  daysLeft: number | null;
  tiers: HeroTier[];
  max: number;
  value: number;
}) {
  const total = Math.max(max, 1);
  const pct = Math.max(16, Math.min(100, (value / total) * 100));
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
  const next = sorted.find((t) => value < t.threshold);
  const missing = next ? next.threshold - value : 0;
  return (
    <div
      aria-hidden
      className="relative overflow-hidden rounded-[2rem] p-5 text-[#fff]"
      style={{
        background:
          "radial-gradient(circle at 100% 0%, rgb(88 192 105 / 0.55), transparent 55%), #141714",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Pill>
          <CalendarDays className="size-3.5" />
          <span className="max-w-40 truncate">{title || "Campanha"}</span>
        </Pill>
        {daysLeft !== null && (
          <Pill>
            <Clock className="size-3.5" />
            faltam {plural(daysLeft, "dia", "dias")}
          </Pill>
        )}
      </div>
      <p className="mt-3.5 text-2xl font-extrabold tracking-tight">
        {value} de {max} selos
      </p>
      <p className="text-sm text-[rgb(255_255_255/0.6)]">
        {sorted.length === 0
          ? "Sem faixas de benefício ainda."
          : next
            ? `Falta${missing > 1 ? "m" : ""} ${plural(missing, "selo", "selos")} para: ${next.label || "…"}`
            : "Completou todas as faixas!"}
      </p>
      <div className="relative mt-5 h-10 overflow-hidden rounded-full bg-[rgb(255_255_255/0.1)]">
        <i
          className="absolute inset-y-0 left-0 flex min-w-16 items-center justify-end rounded-full pr-3.5 text-[15px] font-extrabold text-[#141714] not-italic shadow-[inset_0_-3px_0_rgb(0_0_0/0.12),inset_0_2px_0_rgb(255_255_255/0.3)] transition-[width] duration-700"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #4fb260, #58c069)" }}
        >
          {value}/{max}
        </i>
      </div>
      {sorted.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {sorted.map((t) => {
            const ok = value >= t.threshold;
            const Icon = ok ? Check : iconFor(t.icon);
            return (
              <div
                key={`${t.threshold}-${t.label}`}
                className={cn(
                  "flex min-w-[9rem] flex-1 items-center gap-2.5 rounded-[1.1rem] p-2.5 text-xs leading-snug text-[rgb(255_255_255/0.7)]",
                  ok ? "bg-[rgb(88_192_105/0.16)]" : "bg-[rgb(255_255_255/0.06)]",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-xl",
                    ok ? "bg-[#58c069] text-[#141714]" : "bg-[rgb(255_255_255/0.1)]",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <b className="block text-[13px] text-[#fff]">{t.threshold} selos</b>
                  <span className="line-clamp-2">{t.label || "Benefício"}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-[rgb(255_255_255/0.22)] px-2.5 text-xs font-semibold backdrop-blur">
      {children}
    </span>
  );
}
