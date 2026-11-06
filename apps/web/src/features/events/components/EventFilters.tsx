import { eventRecurrenceSchema, eventStatusSchema, type ListEventsQuery } from "@arp/contracts";
import { FilterX } from "lucide-react";
import { Button, FilterBar, Input, SearchInput, Select } from "@/shared/ui";
import { useEventCategories } from "../api";
import { EVENT_STATUS_LABEL, RECURRENCE_LABEL } from "./EventBadges";

type Filters = Pick<
  ListEventsQuery,
  "categoryId" | "status" | "recurrence" | "from" | "to" | "archived"
>;

/** Valor do filtro "Arquivados" no select de situação (não é um status). */
const ARCHIVED = "arquivados";

/** Busca e filtros da lista de eventos (o estado mora na URL). */
export function EventFilters({
  search,
  onSearch,
  filters,
  onChange,
}: {
  search: string;
  onSearch: (v: string) => void;
  filters: Filters;
  onChange: (patch: Partial<Record<keyof Filters, string | undefined>>) => void;
}) {
  const categories = useEventCategories();
  const active =
    Boolean(search) ||
    Boolean(
      filters.categoryId ||
        filters.status ||
        filters.recurrence ||
        filters.from ||
        filters.to ||
        filters.archived,
    );
  return (
    <div className="mb-5 flex flex-col gap-3">
      <FilterBar className="mb-0">
        <SearchInput
          value={search}
          onChange={onSearch}
          placeholder="Buscar evento pelo nome"
          label="Buscar evento"
          className="w-full sm:w-72"
        />
        <Select
          aria-label="Categoria"
          placeholder="Todas as categorias"
          value={filters.categoryId ?? ""}
          onChange={(e) => onChange({ categoryId: e.target.value || undefined })}
          className="w-full sm:w-48"
        >
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Situação"
          placeholder="Todas as situações"
          value={filters.archived ? ARCHIVED : (filters.status ?? "")}
          onChange={(e) => {
            const v = e.target.value;
            onChange(
              v === ARCHIVED
                ? { status: undefined, archived: "true" }
                : { status: v || undefined, archived: undefined },
            );
          }}
          className="w-full sm:w-44"
        >
          {eventStatusSchema.options.map((s) => (
            <option key={s} value={s}>
              {EVENT_STATUS_LABEL[s]}
            </option>
          ))}
          <option value={ARCHIVED}>Arquivados</option>
        </Select>
        <Select
          aria-label="Recorrência"
          placeholder="Qualquer recorrência"
          value={filters.recurrence ?? ""}
          onChange={(e) => onChange({ recurrence: e.target.value || undefined })}
          className="w-full sm:w-44"
        >
          {eventRecurrenceSchema.options.map((r) => (
            <option key={r} value={r}>
              {RECURRENCE_LABEL[r]}
            </option>
          ))}
        </Select>
      </FilterBar>
      <FilterBar className="mb-0">
        <span className="text-xs text-neutral-500">Acontece entre</span>
        <Input
          type="date"
          aria-label="De"
          value={filters.from ?? ""}
          onChange={(e) => onChange({ from: e.target.value || undefined })}
          className="w-auto"
        />
        <span className="text-xs text-neutral-500">e</span>
        <Input
          type="date"
          aria-label="Até"
          value={filters.to ?? ""}
          min={filters.from}
          onChange={(e) => onChange({ to: e.target.value || undefined })}
          className="w-auto"
        />
        {active && (
          <Button
            variant="ghost"
            size="sm"
            icon={FilterX}
            onClick={() => {
              onSearch("");
              onChange({
                categoryId: undefined,
                status: undefined,
                recurrence: undefined,
                from: undefined,
                to: undefined,
                archived: undefined,
              });
            }}
          >
            Limpar filtros
          </Button>
        )}
      </FilterBar>
    </div>
  );
}
