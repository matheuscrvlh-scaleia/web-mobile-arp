import { useState } from "react";
import { useCoupons } from "@/features/coupons";
import { useEvents } from "@/features/events";
import { useStoreOptions } from "@/features/stores";
import { useDebouncedValue } from "@/shared/hooks";
import { normalize } from "@/shared/lib/text";
import { ResourcePicker } from "./ResourcePicker";

interface PickerProps {
  value: string | null | undefined;
  selectedLabel: string | null | undefined;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}

const LIMIT = 50;

/** Eventos (busca na API; rascunho/cancelado aparecem marcados). */
export function EventPicker(props: PickerProps) {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim());
  const events = useEvents({ q: q || undefined, page: 1, pageSize: LIMIT });
  const options = (events.data?.data ?? []).map((e) => ({
    id: e.id,
    label:
      e.status === "published"
        ? e.title
        : `${e.title} (${e.status === "draft" ? "rascunho" : "cancelado"})`,
  }));
  return (
    <ResourcePicker
      {...props}
      label="Evento"
      placeholder="Escolha o evento"
      search={search}
      onSearch={setSearch}
      options={options}
      loading={events.isFetching}
    />
  );
}

/** Promoções (busca na API), com a loja ao lado. */
export function CouponPicker(props: PickerProps) {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim());
  const coupons = useCoupons({ q: q || undefined, page: 1, pageSize: LIMIT });
  const options = (coupons.data?.data ?? []).map((c) => ({
    id: c.id,
    label: `${c.title} · ${c.store.name}${c.status === "active" ? "" : " (fora do ar)"}`,
  }));
  return (
    <ResourcePicker
      {...props}
      label="Cupom"
      placeholder="Escolha a promoção"
      search={search}
      onSearch={setSearch}
      options={options}
      loading={coupons.isFetching}
    />
  );
}

/** Lojas ativas (lista curta: a busca é local). */
export function StorePicker(props: PickerProps) {
  const [search, setSearch] = useState("");
  const stores = useStoreOptions();
  const q = normalize(search.trim());
  const options = (stores.data ?? [])
    .filter((s) => !q || normalize(s.name).includes(q))
    .map((s) => ({ id: s.id, label: s.name }));
  return (
    <ResourcePicker
      {...props}
      label="Loja"
      placeholder="Escolha a loja"
      search={search}
      onSearch={setSearch}
      options={options}
      loading={stores.isFetching}
    />
  );
}
