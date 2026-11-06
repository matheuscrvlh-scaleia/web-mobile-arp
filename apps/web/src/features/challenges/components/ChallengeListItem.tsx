import type { Challenge } from "@arp/contracts";
import { CalendarDays, QrCode, Store, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { SealBadge } from "@/features/seals";
import { PATHS } from "@/shared/config/paths";
import { cn } from "@/shared/lib/cn";
import { formatNumber, plural } from "@/shared/lib/format";
import { iconFor } from "@/shared/lib/icons";
import { ActionMenu, type ActionMenuItems, DemoMark, Switch } from "@/shared/ui";
import { ChallengeInactiveBadge, ValidationPill } from "./ChallengeBadges";

/**
 * Linha do desafio na lista (no jeito do app: ícone, título, como cumprir,
 * selo). O título leva ao detalhe e a linha inteira é clicável; o switch
 * "Ativo" e o menu "⋯" ficam por cima, no fim. No celular quebra em cartão.
 */
export function ChallengeListItem({
  challenge: c,
  lead,
  menu,
  onToggle,
  toggling = false,
}: {
  challenge: Challenge;
  /** Antes do ícone (alça de arrastar e posição). */
  lead?: ReactNode;
  /** Itens do menu "⋯" (sem = só leitura). */
  menu?: ActionMenuItems;
  /** Liga/desliga (Pausar/Retomar). Sem = não mostra o switch. */
  onToggle?: (active: boolean) => void;
  toggling?: boolean;
}) {
  const Icon = iconFor(c.icon);
  const inactive = c.status === "inactive";
  return (
    <div
      className={cn(
        "vidro flutua group relative flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[1.75rem] p-3 pr-4 sm:flex-nowrap",
        inactive && "bg-white/30",
      )}
    >
      {lead}
      <span
        className={cn(
          "grid size-[3.25rem] shrink-0 place-items-center rounded-[1.1rem] bg-white text-neutral-900 shadow-sm",
          inactive && "opacity-60",
        )}
      >
        <Icon className="size-6" aria-hidden />
      </span>
      <span className={cn("min-w-0 flex-1 basis-48", inactive && "opacity-70")}>
        <span className="flex flex-wrap items-center gap-2">
          <Link
            to={PATHS.challenge(c.id)}
            className="font-semibold text-neutral-900 after:absolute after:inset-0 after:rounded-[1.75rem] hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-neutral-900"
          >
            {c.title}
          </Link>
          <DemoMark show={c.isDemo} />
          {inactive && <ChallengeInactiveBadge />}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-sm text-neutral-500">{c.howTo}</span>
        {(c.store || c.event) && (
          <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600">
            {c.store && (
              <span className="inline-flex items-center gap-1">
                <Store className="size-3.5" aria-hidden />
                {c.store.name}
              </span>
            )}
            {c.event && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" aria-hidden />
                {c.event.title}
              </span>
            )}
          </span>
        )}
      </span>
      <span className={cn("flex shrink-0 items-center gap-2", inactive && "opacity-70")}>
        <SealBadge seal={c.seal} size="sm" />
        <span className="flex flex-col items-start gap-1">
          <span className="text-sm font-medium text-neutral-900">{c.seal.name}</span>
          <ValidationPill validation={c.validation} />
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-start gap-0.5 text-xs text-neutral-500 sm:w-28 sm:items-end">
        <span className="inline-flex items-center gap-1">
          <Trophy className="size-3.5" aria-hidden />
          <b className="font-semibold text-neutral-900 tabular-nums">
            {formatNumber(c.completionsCount)}
          </b>{" "}
          {c.completionsCount === 1 ? "selo dado" : "selos dados"}
        </span>
        {c.validation === "qr" && (
          <span className="inline-flex items-center gap-1">
            <QrCode className="size-3.5" aria-hidden />
            {plural(c.qrCodesCount, "QR Code", "QR Codes")}
          </span>
        )}
      </span>
      {(onToggle || menu) && (
        // Acima do link esticado: o clique aqui não abre o detalhe.
        <span className="relative z-10 ml-auto flex shrink-0 items-center gap-1">
          {onToggle && (
            <Switch
              checked={!inactive}
              onCheckedChange={onToggle}
              disabled={toggling}
              label={`${c.title} ativo no app`}
              hideLabel
              // Alvo de toque de 44 px no celular (o switch em si tem 24 de altura).
              className="items-center p-2 [&_[role=switch]]:before:absolute [&_[role=switch]]:before:-inset-x-1 [&_[role=switch]]:before:-inset-y-2.5 [&_[role=switch]]:before:content-['']"
            />
          )}
          {menu && <ActionMenu items={menu} ariaLabel={`Mais ações de ${c.title}`} size="sm" />}
        </span>
      )}
    </div>
  );
}
