import type { ReactNode } from "react";
import { useNow } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";
import { formatTime } from "@/shared/lib/format";

/**
 * Moldura de celular para prévias "como aparece no app" (destaques, push,
 * cartões). Só ilustração: escondida dos leitores de tela por padrão — quem
 * usa descreve a prévia em texto.
 */
export function PhoneFrame({
  children,
  screen = "light",
  wallpaper,
  className,
  label,
}: {
  children: ReactNode;
  /** Fundo da tela: claro (app) ou escuro (tela bloqueada). */
  screen?: "light" | "dark";
  /** Fundo próprio (ex.: papel de parede da tela bloqueada). */
  wallpaper?: string;
  className?: string;
  /** Com rótulo, a prévia vira uma figura nomeada em vez de decorativa. */
  label?: string;
}) {
  const now = useNow();
  const dark = screen === "dark";
  return (
    <figure
      data-guia="previa"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn(
        "relative mx-auto w-[18.5rem] max-w-full shrink-0 rounded-[3rem] bg-[#0d0f0d] p-2.5 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.6),inset_0_0_0_1.5px_rgb(255_255_255/0.08)]",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex h-[36rem] flex-col overflow-hidden rounded-[2.4rem]",
          dark ? "text-[#fff]" : "bg-[#f6f5f3] text-[#141714]",
        )}
        style={
          wallpaper
            ? { background: wallpaper }
            : dark
              ? {
                  background:
                    "radial-gradient(30rem 20rem at 20% 0%, #2f7d3d, transparent 60%), radial-gradient(24rem 18rem at 100% 100%, #173d1f, transparent 60%), #0b0d0b",
                }
              : undefined
        }
      >
        <div className="relative z-10 flex h-11 shrink-0 items-center justify-between px-7 text-[13px] font-semibold tabular-nums">
          <span>{formatTime(new Date(now))}</span>
          <span className="absolute top-2.5 left-1/2 h-6 w-24 -translate-x-1/2 rounded-full bg-[#0d0f0d]" />
          <span className="flex items-center gap-1">
            <i className="block h-2.5 w-4 rounded-[2px] bg-current opacity-80" />
            <i className="block h-3 w-6 rounded-[4px] border border-current opacity-80" />
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        <span className="absolute bottom-2 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-current opacity-40" />
      </div>
    </figure>
  );
}
