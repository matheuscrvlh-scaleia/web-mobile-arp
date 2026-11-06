import type { HighlightTargetIssue } from "@arp/contracts";
import { useMemo, useState } from "react";
import { useCoupon, useCoupons } from "@/features/coupons";
import { useEvent, useEvents } from "@/features/events";
import { StoreSelect, useStoreOptions } from "@/features/stores";
import { useDebouncedValue } from "@/shared/hooks";
import { Combobox, type ComboboxOption } from "@/shared/ui";

export interface PickerProps {
  value: string | null | undefined;
  selectedLabel?: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  onBlur?: () => void;
  name?: string;
}

const LIMIT = 50;

const EVENT_STATE: Record<string, string> = {
  draft: "Rascunho (fora do app)",
  paused: "Pausado (fora do app)",
  cancelled: "Cancelado",
};

const COUPON_STATE: Record<string, string> = {
  draft: "Rascunho (fora do app)",
  paused: "Pausado (fora do app)",
  ended: "Encerrado",
  archived: "Arquivado",
};

/** Eventos com busca na API; os fora do app aparecem com a situação ao lado. */
export function EventPicker({ selectedLabel, ...props }: PickerProps) {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim());
  const events = useEvents({ q: q || undefined, page: 1, pageSize: LIMIT });
  const options = useMemo<ComboboxOption[]>(
    () =>
      (events.data?.data ?? []).map((e) => ({
        value: e.id,
        label: e.title,
        description: EVENT_STATE[e.status],
      })),
    [events.data],
  );
  return (
    <Combobox
      {...props}
      placeholder="Escolha o evento"
      emptyText="Nenhum evento com esse nome"
      options={options}
      onSearch={setSearch}
      loading={events.isFetching}
      selectedLabel={selectedLabel ?? undefined}
    />
  );
}

/** Cupons com busca na API, com a loja ao lado. */
export function CouponPicker({ selectedLabel, ...props }: PickerProps) {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim());
  const coupons = useCoupons({ q: q || undefined, page: 1, pageSize: LIMIT });
  const options = useMemo<ComboboxOption[]>(
    () =>
      (coupons.data?.data ?? []).map((c) => ({
        value: c.id,
        label: c.title,
        description: [c.store.name, COUPON_STATE[c.status]].filter(Boolean).join(" · "),
      })),
    [coupons.data],
  );
  return (
    <Combobox
      {...props}
      placeholder="Escolha o cupom"
      emptyText="Nenhum cupom com esse nome"
      options={options}
      onSearch={setSearch}
      loading={coupons.isFetching}
      selectedLabel={selectedLabel ?? undefined}
    />
  );
}

/** Lojas ativas (busca local). */
export function StorePicker({ selectedLabel, ...props }: PickerProps) {
  return <StoreSelect {...props} selectedLabel={selectedLabel ?? undefined} />;
}

/** Texto do aviso quando o destino não abre direito no app. */
export const TARGET_ISSUE_TEXT: Record<HighlightTargetIssue, string> = {
  draft: "está em rascunho: ainda não aparece no app",
  paused: "está pausado: não aparece no app agora",
  cancelled: "está cancelado: o visitante cai numa página de cancelado",
  ended: "já terminou",
  archived: "está arquivado: não aparece no app",
  inactive: "está desativada: não aparece no app",
  missing: "não existe mais",
};

/**
 * Situação do destino escolhido agora (evento, cupom ou loja), para avisar
 * antes de publicar. null = destino ok ou ainda carregando.
 */
export function useTargetIssue(
  type: "event" | "coupon" | "store" | null,
  id: string | null | undefined,
): HighlightTargetIssue | null {
  const event = useEvent(type === "event" ? (id ?? undefined) : undefined);
  const coupon = useCoupon(type === "coupon" ? (id ?? undefined) : undefined);
  const stores = useStoreOptions({ enabled: type === "store" });
  if (!id) return null;
  if (type === "event" && event.data) {
    const e = event.data;
    if (e.archivedAt) return "archived";
    if (e.status !== "published") return e.status;
    return null;
  }
  if (type === "coupon" && coupon.data) {
    const s = coupon.data.status as string;
    return s === "active" ? null : ((s in COUPON_STATE ? s : "paused") as HighlightTargetIssue);
  }
  if (type === "store" && stores.data) {
    return stores.data.some((s) => s.id === id) ? null : "inactive";
  }
  return null;
}
