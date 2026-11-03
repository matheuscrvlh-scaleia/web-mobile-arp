import {
  COUPON_REVIEW_LABEL,
  couponReviewSchema,
  couponStatusSchema,
  type ListCouponsQuery,
  STORE_KIND_LABEL,
  type StoreKind,
  storeKindSchema,
} from "@arp/contracts";
import { FilterX } from "lucide-react";
import { useStoreOptions } from "@/features/stores";
import { Button, FilterBar, SearchInput, Segmented, Select } from "@/shared/ui";
import { COUPON_STATUS } from "./CouponBadges";

type Filters = Pick<ListCouponsQuery, "storeId" | "status" | "kind" | "review">;

const KIND_OPTIONS: { value: StoreKind | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  ...storeKindSchema.options.map((k) => ({ value: k, label: STORE_KIND_LABEL[k] })),
];

/** Busca e filtros das promoções (o estado mora na URL). Lojista não vê filtro de loja. */
export function CouponFilters({
  search,
  onSearch,
  filters,
  onChange,
  merchant,
}: {
  search: string;
  onSearch: (value: string) => void;
  filters: Filters;
  onChange: (patch: Partial<Record<keyof Filters, string | undefined>>) => void;
  merchant: boolean;
}) {
  const stores = useStoreOptions({ enabled: !merchant });
  const visibleStores = (stores.data ?? []).filter((s) => !filters.kind || s.kind === filters.kind);
  const active = Boolean(search) || Object.values(filters).some((v) => v !== undefined && v !== "");

  return (
    <FilterBar className="mb-5">
      <SearchInput
        value={search}
        onChange={onSearch}
        placeholder="Buscar promoção"
        label="Buscar promoção"
        className="w-full sm:w-64"
      />
      {!merchant && (
        <>
          <Segmented
            label="Tipo de loja"
            size="sm"
            options={KIND_OPTIONS}
            value={filters.kind ?? "all"}
            onChange={(v) => onChange({ kind: v === "all" ? undefined : v, storeId: undefined })}
          />
          <Select
            aria-label="Loja"
            placeholder="Todas as lojas"
            value={filters.storeId ?? ""}
            onChange={(e) => onChange({ storeId: e.target.value || undefined })}
            className="w-full sm:w-52"
          >
            {visibleStores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </>
      )}
      <Select
        aria-label="Situação"
        placeholder="Todas as situações"
        value={filters.status ?? ""}
        onChange={(e) => onChange({ status: e.target.value || undefined })}
        className="w-full sm:w-48"
      >
        {couponStatusSchema.options.map((s) => (
          <option key={s} value={s}>
            {COUPON_STATUS[s].plural}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Revisão da ARP"
        placeholder="Qualquer revisão"
        value={filters.review ?? ""}
        onChange={(e) => onChange({ review: (e.target.value || undefined) as Filters["review"] })}
        className="w-full sm:w-48"
      >
        {couponReviewSchema.options.map((r) => (
          <option key={r} value={r}>
            {COUPON_REVIEW_LABEL[r]}
          </option>
        ))}
      </Select>
      {active && (
        <Button
          variant="ghost"
          size="sm"
          icon={FilterX}
          onClick={() => {
            onSearch("");
            onChange({ storeId: undefined, status: undefined, kind: undefined, review: undefined });
          }}
        >
          Limpar filtros
        </Button>
      )}
    </FilterBar>
  );
}
