import { ChevronLeft, ChevronRight, CircleDashed, CircleOff } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { addMonths, currentMonth, MONTH_LABEL, todayIso } from "@/shared/lib/dates";
import {
  Button,
  Card,
  CardHeader,
  ErrorState,
  IconButton,
  LoadingRegion,
  Skeleton,
} from "@/shared/ui";
import { useEventOccurrences } from "../../api";
import { isMonth, monthWeeks, splitOccurrences } from "../../lib/calendar";
import { AgendaList } from "./AgendaList";
import { LongEventCard } from "./LongEventCard";
import { MonthGrid } from "./MonthGrid";

/** Mês do calendário na URL (?mes=2026-10); inválido ou ausente = mês atual em SP. */
function useMonthParam(): [string, (m: string) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("mes");
  const month = isMonth(raw) ? raw : currentMonth();
  const set = useCallback(
    (m: string) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (m === currentMonth()) next.delete("mes");
          else next.set("mes", m);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  return [month, set];
}

const monthTitle = (m: string) => {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  return `${MONTH_LABEL[mo - 1]} de ${y}`;
};

/** Aba "Calendário": o mês com faixas (eventos longos) e eventos por dia. */
export function EventsCalendar() {
  const [month, setMonth] = useMonthParam();
  const today = todayIso();
  const weeks = monthWeeks(month);
  const from = weeks[0]?.[0] ?? `${month}-01`;
  const to = weeks[weeks.length - 1]?.[6] ?? `${month}-28`;
  const occurrences = useEventOccurrences(from, to);
  const split = useMemo(() => splitOccurrences(occurrences.data ?? []), [occurrences.data]);
  const longsInMonth = split.longs.filter((l) => [...l.days].some((d) => d.startsWith(month)));

  return (
    <Card>
      <CardHeader
        title={<span className="capitalize">{monthTitle(month)}</span>}
        description="Eventos longos aparecem como faixa em todos os dias; os demais, no dia."
        action={
          <>
            {occurrences.isFetching && !occurrences.isLoading && (
              <span className="text-xs text-neutral-500" aria-live="polite">
                Atualizando…
              </span>
            )}
            <IconButton
              icon={ChevronLeft}
              variant="secondary"
              label="Mês anterior"
              onClick={() => setMonth(addMonths(month, -1))}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMonth(currentMonth())}
              disabled={month === currentMonth()}
            >
              Hoje
            </Button>
            <IconButton
              icon={ChevronRight}
              variant="secondary"
              label="Próximo mês"
              onClick={() => setMonth(addMonths(month, 1))}
            />
          </>
        }
      />
      {occurrences.error ? (
        <ErrorState error={occurrences.error} onRetry={() => void occurrences.refetch()} />
      ) : !occurrences.data ? (
        <LoadingRegion>
          <Skeleton className="h-32 rounded-[1.6rem]" />
          <Skeleton className="h-[30rem] rounded-[1.4rem]" />
        </LoadingRegion>
      ) : (
        <div className="flex flex-col gap-5" aria-busy={occurrences.isFetching || undefined}>
          {longsInMonth.length > 0 && (
            <section aria-label="Eventos longos do mês" className="grid gap-3 lg:grid-cols-2">
              {longsInMonth.map((l) => (
                <LongEventCard key={l.id} event={l} month={month} today={today} />
              ))}
            </section>
          )}
          <div className="hidden md:block">
            <MonthGrid month={month} today={today} byDay={split.byDay} longs={split.longs} />
          </div>
          <div className="md:hidden">
            <AgendaList month={month} today={today} byDay={split.byDay} />
          </div>
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <CircleDashed className="size-3.5" aria-hidden />
              Tracejado: rascunho (fora do app)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CircleOff className="size-3.5" aria-hidden />
              Riscado: cancelado
            </span>
          </p>
        </div>
      )}
    </Card>
  );
}
