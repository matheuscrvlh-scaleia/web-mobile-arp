import type { StoreOption } from "@arp/contracts";
import { useMemo } from "react";
import {
  Combobox,
  type ComboboxMultipleProps,
  type ComboboxOption,
  type ComboboxSingleProps,
} from "@/shared/ui";
import { useStoreOptions } from "../api";

// Escolher loja(s) com busca, no lugar do <select> com ~190 lojas. Carrega
// a lista enxuta de lojas ativas uma vez (≈20 KB, cache de 5 min,
// compartilhado com as outras telas) e filtra no navegador, sem acento.

type Omitted = "options" | "loading";
export type StoreSelectProps =
  | Omit<ComboboxSingleProps, Omitted>
  | Omit<ComboboxMultipleProps, Omitted>;

const place = (s: StoreOption) => [s.floorLabel, s.blockName].filter(Boolean).join(" · ");

/** Opções do Combobox a partir das lojas (útil para montar um filtro próprio). */
export function storeComboboxOptions(stores: StoreOption[]): ComboboxOption[] {
  return stores.map((s) => ({
    value: s.id,
    label: s.name,
    description: place(s) || undefined,
    leading: (
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
        style={{ background: s.brandColor }}
      />
    ),
  }));
}

/**
 * Loja com busca (nome; andar e bloco como texto secundário). Igual ao
 * Combobox: `value`/`onChange`, `multiple` para várias, e funciona com
 * `<Controller render={({ field }) => <StoreSelect {...field} />} />`.
 */
export function StoreSelect(props: StoreSelectProps) {
  const stores = useStoreOptions();
  const options = useMemo(() => storeComboboxOptions(stores.data ?? []), [stores.data]);
  return (
    <Combobox
      placeholder={props.multiple ? "Escolha as lojas" : "Escolha a loja"}
      emptyText="Nenhuma loja com esse nome"
      {...(props as ComboboxSingleProps)}
      options={options}
      loading={stores.isLoading}
    />
  );
}
