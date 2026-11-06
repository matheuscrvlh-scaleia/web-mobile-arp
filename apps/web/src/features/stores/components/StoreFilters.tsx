import {
  type ListStoresQuery,
  STORE_KIND_LABEL,
  type StoreKind,
  storeKindSchema,
} from "@arp/contracts";
import { FilterX, SlidersHorizontal } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useBlocks, useStoreCategories } from "@/features/catalog";
import { useFloors } from "@/features/map";
import { useIsMobile, useSearchText } from "@/shared/hooks";
import { Button, Field, FilterBar, Modal, SearchInput, Segmented, Select } from "@/shared/ui";
import { STORE_STATUS_LABEL } from "./StoreBadges";

export type StoreFilterValues = Pick<
  ListStoresQuery,
  "kind" | "categoryId" | "blockId" | "floorId" | "status" | "missing"
>;
type Patch = Partial<Record<keyof StoreFilterValues | "q", string | undefined>>;

const KIND_OPTIONS: { value: StoreKind | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  ...storeKindSchema.options.map((k) => ({ value: k, label: STORE_KIND_LABEL[k] })),
];

/** Opções do filtro "Pendências" (o que falta no cadastro). */
const MISSING_OPTIONS: { value: NonNullable<ListStoresQuery["missing"]>; label: string }[] = [
  { value: "any", label: "Com alguma pendência" },
  { value: "hours", label: "Sem horário" },
  { value: "cover", label: "Sem foto de capa" },
  { value: "logo", label: "Sem logo" },
  { value: "map", label: "Fora do mapa" },
  { value: "description", label: "Sem descrição" },
];

export const CLEAR_STORE_FILTERS: Patch = {
  kind: undefined,
  categoryId: undefined,
  floorId: undefined,
  blockId: undefined,
  status: undefined,
  missing: undefined,
};

/** Quantos filtros (fora a busca) estão ligados. */
export const activeFilterCount = (f: StoreFilterValues) =>
  // Só as chaves de filtro: a página recebe a query inteira (page, pageSize, sort…).
  (Object.keys(CLEAR_STORE_FILTERS) as (keyof StoreFilterValues)[]).filter(
    (k) => f[k] !== undefined && f[k] !== "",
  ).length;

/**
 * Busca e filtros da lista de lojas (o estado mora na URL, na página). O
 * texto da busca mora aqui: cada tecla só redesenha os filtros, não a lista.
 * Trocar um filtro grava junto o texto atual (sem esperar a busca). No
 * celular, só a busca e o botão "Filtros (n)", que abre os filtros numa
 * janela, para a lista aparecer logo.
 */
export function StoreFilters({
  q,
  onSearch,
  filters,
  onChange,
}: {
  /** Busca gravada na URL. */
  q: string | undefined;
  /** Grava a busca na URL (depois que a pessoa para de digitar). */
  onSearch: (value: string) => void;
  filters: StoreFilterValues;
  onChange: (patch: Patch) => void;
}) {
  const mobile = useIsMobile();
  const [sheet, setSheet] = useState(false);
  const [search, setSearch, flushSearch] = useSearchText(q, onSearch);
  const change = (patch: Patch) => onChange({ ...patch, q: flushSearch() || undefined });
  const count = activeFilterCount(filters);
  const active = Boolean(search) || count > 0;
  const clear = () => {
    setSearch("");
    onChange({ ...CLEAR_STORE_FILTERS, q: undefined });
  };

  const searchInput = (
    <SearchInput
      value={search}
      onChange={setSearch}
      placeholder="Buscar por nome, categoria ou descrição"
      label="Buscar loja"
      className="w-full sm:w-80"
    />
  );

  if (mobile) {
    return (
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">{searchInput}</div>
          <Button
            variant={count > 0 ? "primary" : "secondary"}
            icon={SlidersHorizontal}
            onClick={() => setSheet(true)}
            className="h-10 shrink-0"
          >
            Filtros{count > 0 ? ` (${count})` : ""}
          </Button>
        </div>
        {active && (
          <Button variant="ghost" size="sm" icon={FilterX} onClick={clear} className="self-start">
            Limpar filtros
          </Button>
        )}
        <Modal
          open={sheet}
          onClose={() => setSheet(false)}
          title="Filtros"
          footer={
            <>
              {count > 0 && (
                <Button
                  variant="secondary"
                  icon={FilterX}
                  onClick={() => change(CLEAR_STORE_FILTERS)}
                >
                  Limpar
                </Button>
              )}
              <Button onClick={() => setSheet(false)}>Ver lojas</Button>
            </>
          }
        >
          <div className="flex flex-col gap-4 pb-2">
            <FilterFields filters={filters} onChange={change} stacked />
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="mb-5 flex flex-col gap-3">
      <FilterBar className="mb-0">
        {searchInput}
        <Segmented
          label="Tipo de loja"
          size="sm"
          options={KIND_OPTIONS}
          value={filters.kind ?? "all"}
          onChange={(v) =>
            change({
              kind: v === "all" ? undefined : v,
              // Categoria de outro tipo não faz sentido com o novo filtro.
              categoryId: undefined,
            })
          }
        />
      </FilterBar>
      <FilterBar className="mb-0">
        <FilterFields filters={filters} onChange={change} />
        {active && (
          <Button variant="ghost" size="sm" icon={FilterX} onClick={clear}>
            Limpar filtros
          </Button>
        )}
      </FilterBar>
    </div>
  );
}

/** Os selects (lado a lado no computador; um embaixo do outro na janela do celular). */
function FilterFields({
  filters,
  onChange,
  stacked = false,
}: {
  filters: StoreFilterValues;
  onChange: (patch: Patch) => void;
  stacked?: boolean;
}) {
  const categories = useStoreCategories();
  const floors = useFloors();
  const blocks = useBlocks();
  const visibleCategories = (categories.data ?? []).filter(
    (c) => !filters.kind || c.kind === filters.kind,
  );
  const wrap = (label: string, width: string, select: ReactNode) =>
    stacked ? <Field label={label}>{select}</Field> : <div className={width}>{select}</div>;

  return (
    <>
      {stacked &&
        wrap(
          "Tipo",
          "",
          <Select
            aria-label="Tipo de loja"
            value={filters.kind ?? ""}
            onChange={(e) => onChange({ kind: e.target.value || undefined, categoryId: undefined })}
          >
            <option value="">Todas</option>
            {storeKindSchema.options.map((k) => (
              <option key={k} value={k}>
                {STORE_KIND_LABEL[k]}
              </option>
            ))}
          </Select>,
        )}
      {wrap(
        "Categoria",
        "w-full sm:w-52",
        <Select
          aria-label="Categoria"
          placeholder="Todas as categorias"
          value={filters.categoryId ?? ""}
          onChange={(e) => onChange({ categoryId: e.target.value || undefined })}
        >
          {visibleCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>,
      )}
      {wrap(
        "Andar",
        "w-full sm:w-40",
        <Select
          aria-label="Andar"
          placeholder="Todos os andares"
          value={filters.floorId ?? ""}
          onChange={(e) => onChange({ floorId: e.target.value || undefined })}
        >
          {(floors.data ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </Select>,
      )}
      {wrap(
        "Bloco",
        "w-full sm:w-40",
        <Select
          aria-label="Bloco"
          placeholder="Todos os blocos"
          value={filters.blockId ?? ""}
          onChange={(e) => onChange({ blockId: e.target.value || undefined })}
        >
          {(blocks.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>,
      )}
      {wrap(
        "Situação",
        "w-full sm:w-40",
        <Select
          aria-label="Situação"
          placeholder="Ativas e inativas"
          value={filters.status ?? ""}
          onChange={(e) => onChange({ status: e.target.value || undefined })}
        >
          <option value="active">{STORE_STATUS_LABEL.active}s</option>
          <option value="inactive">{STORE_STATUS_LABEL.inactive}s</option>
        </Select>,
      )}
      {wrap(
        "Pendências",
        "w-full sm:w-52",
        <Select
          aria-label="Pendências do cadastro"
          placeholder="Cadastro: todos"
          value={filters.missing ?? ""}
          onChange={(e) => onChange({ missing: e.target.value || undefined })}
        >
          {MISSING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>,
      )}
    </>
  );
}
