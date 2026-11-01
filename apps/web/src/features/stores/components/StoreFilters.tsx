import {
  type ListStoresQuery,
  STORE_KIND_LABEL,
  type StoreKind,
  storeKindSchema,
} from "@arp/contracts";
import { FilterX } from "lucide-react";
import { useBlocks, useStoreCategories } from "@/features/catalog";
import { useFloors } from "@/features/map";
import { Button, FilterBar, SearchInput, Segmented, Select } from "@/shared/ui";
import { STORE_STATUS_LABEL } from "./StoreBadges";

type Filters = Pick<ListStoresQuery, "kind" | "categoryId" | "blockId" | "floorId" | "status">;

const KIND_OPTIONS: { value: StoreKind | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  ...storeKindSchema.options.map((k) => ({ value: k, label: STORE_KIND_LABEL[k] })),
];

/** Busca e filtros da lista de lojas (o estado mora na URL, na página). */
export function StoreFilters({
  search,
  onSearch,
  filters,
  onChange,
}: {
  search: string;
  onSearch: (value: string) => void;
  filters: Filters;
  onChange: (patch: Partial<Record<keyof Filters, string | undefined>>) => void;
}) {
  const categories = useStoreCategories();
  const floors = useFloors();
  const blocks = useBlocks();
  const visibleCategories = (categories.data ?? []).filter(
    (c) => !filters.kind || c.kind === filters.kind,
  );
  const active = Boolean(search) || Object.values(filters).some((v) => v !== undefined && v !== "");

  return (
    <div className="mb-5 flex flex-col gap-3">
      <FilterBar className="mb-0">
        <SearchInput
          value={search}
          onChange={onSearch}
          placeholder="Buscar loja pelo nome"
          label="Buscar loja"
          className="w-full sm:w-72"
        />
        <Segmented
          label="Tipo de loja"
          size="sm"
          options={KIND_OPTIONS}
          value={filters.kind ?? "all"}
          onChange={(v) =>
            onChange({
              kind: v === "all" ? undefined : v,
              // Categoria de outro tipo não faz sentido com o novo filtro.
              categoryId: undefined,
            })
          }
        />
      </FilterBar>
      <FilterBar className="mb-0">
        <Select
          aria-label="Categoria"
          placeholder="Todas as categorias"
          value={filters.categoryId ?? ""}
          onChange={(e) => onChange({ categoryId: e.target.value || undefined })}
          className="w-full sm:w-52"
        >
          {visibleCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Andar"
          placeholder="Todos os andares"
          value={filters.floorId ?? ""}
          onChange={(e) => onChange({ floorId: e.target.value || undefined })}
          className="w-full sm:w-44"
        >
          {(floors.data ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Bloco"
          placeholder="Todos os blocos"
          value={filters.blockId ?? ""}
          onChange={(e) => onChange({ blockId: e.target.value || undefined })}
          className="w-full sm:w-44"
        >
          {(blocks.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Situação"
          placeholder="Ativas e inativas"
          value={filters.status ?? ""}
          onChange={(e) => onChange({ status: e.target.value || undefined })}
          className="w-full sm:w-44"
        >
          <option value="active">{STORE_STATUS_LABEL.active}s</option>
          <option value="inactive">{STORE_STATUS_LABEL.inactive}s</option>
        </Select>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            icon={FilterX}
            onClick={() => {
              onSearch("");
              onChange({
                kind: undefined,
                categoryId: undefined,
                floorId: undefined,
                blockId: undefined,
                status: undefined,
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
