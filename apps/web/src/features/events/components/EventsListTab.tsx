import { listEventsQuerySchema } from "@arp/contracts";
import { CalendarDays, Plus, SearchX } from "lucide-react";
import { useCallback } from "react";
import { PATHS } from "@/shared/config/paths";
import { useSearchText, useUrlState } from "@/shared/hooks";
import {
  ButtonLink,
  Can,
  Card,
  EmptyState,
  ErrorState,
  LoadingRegion,
  Pagination,
  Skeleton,
} from "@/shared/ui";
import { useEvents } from "../api";
import { EventFilters } from "./EventFilters";
import { EventRow } from "./EventRow";

/** Aba "Lista": eventos paginados com busca e filtros na URL. */
export function EventsListTab() {
  const [query, setQuery] = useUrlState(listEventsQuerySchema);
  const commit = useCallback((q: string) => setQuery({ q }, { replace: true }), [setQuery]);
  const [search, setSearch] = useSearchText(query.q, commit);
  const events = useEvents(query);
  const filtered = Boolean(
    query.q || query.categoryId || query.status || query.recurrence || query.from || query.to,
  );

  return (
    <>
      <EventFilters search={search} onSearch={setSearch} filters={query} onChange={setQuery} />
      <Card padding="sm">
        {events.error ? (
          <ErrorState error={events.error} onRetry={() => void events.refetch()} />
        ) : !events.data ? (
          <LoadingRegion className="gap-2 p-2">
            {Array.from({ length: 5 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: linhas-esqueleto fixas
              <Skeleton key={i} className="h-24 rounded-[1.4rem]" />
            ))}
          </LoadingRegion>
        ) : events.data.data.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={SearchX}
              title="Nenhum evento com esses filtros"
              description="Tente outro nome ou limpe os filtros."
            />
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="A agenda está vazia"
              description="Cadastre o primeiro evento: único, de vários dias ou semanal."
              action={
                <Can permission="events.manage">
                  <ButtonLink to={PATHS.eventNew} icon={Plus}>
                    Novo evento
                  </ButtonLink>
                </Can>
              }
            />
          )
        ) : (
          <>
            <ul
              aria-label="Eventos"
              aria-busy={events.isFetching || undefined}
              className="flex flex-col divide-y divide-neutral-900/[0.06]"
            >
              {events.data.data.map((e) => (
                <li key={e.id} className="py-1">
                  <EventRow event={e} />
                </li>
              ))}
            </ul>
            <div className="px-2 pb-1">
              <Pagination meta={events.data.meta} onPageChange={(page) => setQuery({ page })} />
            </div>
          </>
        )}
      </Card>
    </>
  );
}
