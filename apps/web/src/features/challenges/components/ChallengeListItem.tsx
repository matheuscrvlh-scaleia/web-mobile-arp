import type { Challenge } from "@arp/contracts";
import { CalendarDays, ChevronRight, QrCode, Store, Trophy } from "lucide-react";
import { Link } from "react-router";
import { SealBadge } from "@/features/seals";
import { PATHS } from "@/shared/config/paths";
import { cn } from "@/shared/lib/cn";
import { formatNumber, plural } from "@/shared/lib/format";
import { iconFor } from "@/shared/lib/icons";
import { DemoMark } from "@/shared/ui";
import { ChallengeInactiveBadge, ValidationPill } from "./ChallengeBadges";

/** Linha do desafio na lista (no jeito do app: ícone, título, como cumprir, selo). */
export function ChallengeListItem({ challenge: c }: { challenge: Challenge }) {
  const Icon = iconFor(c.icon);
  const inactive = c.status === "inactive";
  return (
    <Link
      to={PATHS.challenge(c.id)}
      className={cn(
        "vidro flutua group flex flex-wrap items-center gap-4 rounded-[1.75rem] p-3 pr-4 sm:flex-nowrap",
        inactive && "opacity-70",
      )}
    >
      <span className="w-6 shrink-0 text-center text-xs text-neutral-400 tabular-nums">
        <span className="sr-only">Ordem </span>
        {c.sortOrder}
      </span>
      <span className="grid size-[3.25rem] shrink-0 place-items-center rounded-[1.1rem] bg-white text-neutral-900 shadow-sm">
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 basis-56">
        <span className="flex flex-wrap items-center gap-2">
          <b className="font-semibold text-neutral-900">{c.title}</b>
          <DemoMark show={c.isDemo} />
          {inactive && <ChallengeInactiveBadge />}
        </span>
        <span className="mt-0.5 block text-sm text-neutral-500">{c.howTo}</span>
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
      <span className="flex shrink-0 items-center gap-2">
        <SealBadge seal={c.seal} size="sm" />
        <span className="flex flex-col items-start gap-1">
          <span className="text-sm font-medium text-neutral-900">{c.seal.name}</span>
          <ValidationPill validation={c.validation} />
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5 text-xs text-neutral-500 sm:w-32">
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
      <ChevronRight
        className="hidden size-4 shrink-0 text-neutral-400 group-hover:text-neutral-900 sm:block"
        aria-hidden
      />
    </Link>
  );
}
