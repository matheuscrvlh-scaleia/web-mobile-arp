import { Repeat } from "lucide-react";
import { Link } from "react-router";
import { PATHS } from "@/shared/config/paths";
import { cn } from "@/shared/lib/cn";
import { monthBounds } from "@/shared/lib/dates";
import { formatNumber } from "@/shared/lib/format";
import type { LongEvent } from "../../lib/calendar";
import { statusSuffix } from "./OccurrenceLink";

/**
 * Evento longo como no app (`.ev-long`): cartão escuro com a barra do mês,
 * um traço por dia; os dias que já passaram ficam acesos e hoje se destaca.
 */
export function LongEventCard({
  event,
  month,
  today,
}: {
  event: LongEvent;
  month: string;
  today: string;
}) {
  const [first, last] = monthBounds(month);
  const total = Number(last.slice(8));
  const days = Array.from(
    { length: total },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
  const inMonth = days.filter((d) => event.days.has(d));
  const firstOn = inMonth[0];
  const lastOn = inMonth[inMonth.length - 1];
  const whole = inMonth.length === total;
  const todayIndex = today >= first && today <= last ? Number(today.slice(8)) : null;
  const caption = whole
    ? "O mês inteiro"
    : firstOn && lastOn
      ? `Dias ${Number(firstOn.slice(8))} a ${Number(lastOn.slice(8))}`
      : "";

  return (
    <Link
      to={PATHS.event(event.id)}
      className={cn(
        "tom-app-deep flutua relative block overflow-hidden rounded-[1.6rem] p-5",
        event.status === "cancelled" && "opacity-70",
      )}
    >
      <span
        aria-hidden
        className="absolute -top-16 -right-10 size-48 rounded-full bg-[rgb(88_192_105/0.35)] blur-3xl"
      />
      <span className="relative flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(255_255_255/0.18)] px-2.5 py-1 text-xs font-semibold backdrop-blur">
          <Repeat className="size-3.5" aria-hidden />
          {caption}
        </span>
        {event.status !== "published" && (
          <span className="rounded-full border border-dashed border-[rgb(255_255_255/0.6)] px-2.5 py-0.5 text-xs">
            {event.status === "draft" ? "Rascunho" : "Cancelado"}
          </span>
        )}
      </span>
      <span
        className={cn(
          "relative mt-3 block text-xl font-bold tracking-tight",
          event.status === "cancelled" && "line-through",
        )}
      >
        {event.title}
        <span className="sr-only">{statusSuffix(event.status)}</span>
      </span>
      <span aria-hidden className="relative mt-3 flex gap-[2px]">
        {days.map((d, i) => (
          <i
            key={d}
            className={cn(
              "block h-[5px] flex-1 rounded-[2px]",
              !event.days.has(d)
                ? "bg-[rgb(255_255_255/0.08)]"
                : todayIndex !== null && i + 1 < todayIndex
                  ? "bg-[rgb(255_255_255/0.6)]"
                  : i + 1 === todayIndex
                    ? "scale-y-[1.8] bg-marca"
                    : "bg-[rgb(255_255_255/0.25)]",
            )}
          />
        ))}
      </span>
      <span className="relative mt-2 block text-xs opacity-75">
        {todayIndex !== null && event.days.has(today)
          ? `Dia ${formatNumber(todayIndex)} de ${formatNumber(total)} · aparece em todos os dias da agenda`
          : `${formatNumber(inMonth.length)} dias neste mês · aparece como faixa na agenda`}
      </span>
    </Link>
  );
}
