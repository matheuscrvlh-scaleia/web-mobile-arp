import { useState } from "react";
import { useCoupons } from "@/features/coupons";
import { useDebouncedValue } from "@/shared/hooks";
import { SearchInput, Select } from "@/shared/ui";

const STATUS_NOTE = { draft: " (rascunho)", paused: " (pausado)", ended: " (encerrado)" } as const;

/**
 * Cupom do gatilho "a loja deu baixa": busca pelo título e escolhe na lista.
 * O cupom atual continua na lista mesmo fora da busca.
 */
export function CouponSelect({
  value,
  current,
  onChange,
  onBlur,
  disabled = false,
}: {
  value: string | null | undefined;
  /** Cupom já salvo (para mostrar o nome sem depender da busca). */
  current: { id: string; title: string; storeName: string } | null;
  onChange: (coupon: { id: string; storeId: string } | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 300);
  const coupons = useCoupons({ q: q || undefined, pageSize: 30 }, { enabled: !disabled });
  const options = coupons.data?.data ?? [];
  const showCurrent = current && !options.some((c) => c.id === current.id);

  return (
    <div className="flex flex-col gap-2">
      {!disabled && (
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar cupom pelo título"
          label="Buscar cupom"
        />
      )}
      <Select
        placeholder="Escolha o cupom"
        value={value ?? ""}
        disabled={disabled}
        onBlur={onBlur}
        onChange={(e) => {
          const picked = options.find((c) => c.id === e.target.value);
          if (picked) onChange({ id: picked.id, storeId: picked.store.id });
          else if (!e.target.value) onChange(null);
        }}
      >
        {showCurrent && (
          <option value={current.id}>
            {current.title} · {current.storeName}
          </option>
        )}
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title} · {c.store.name}
            {c.status !== "active" ? STATUS_NOTE[c.status] : ""}
          </option>
        ))}
      </Select>
      {coupons.isFetching && (
        <span className="text-xs text-neutral-500" aria-live="polite">
          Buscando…
        </span>
      )}
    </div>
  );
}
