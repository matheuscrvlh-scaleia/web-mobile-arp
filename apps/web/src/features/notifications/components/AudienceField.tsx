import { type NotificationAudience, notificationAudienceSchema } from "@arp/contracts";
import { Users } from "lucide-react";
import { useId } from "react";
import { useStoreOptions } from "@/features/stores";
import { cn } from "@/shared/lib/cn";
import { formatNumber, plural } from "@/shared/lib/format";
import { Field, Select, Spinner } from "@/shared/ui";
import { useAudienceEstimate } from "../api";
import { AUDIENCE } from "./NotificationBadges";

/** Público: três opções com explicação (rádios nativos em cartões). */
export function AudiencePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: NotificationAudience;
  onChange: (value: NotificationAudience) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-3" disabled={disabled}>
      <legend className="sr-only">Público</legend>
      {notificationAudienceSchema.options.map((a) => {
        const { label, description, icon: Icon } = AUDIENCE[a];
        const on = a === value;
        return (
          <label
            key={a}
            className={cn(
              "flex cursor-pointer flex-col gap-1.5 rounded-2xl border border-neutral-200 bg-white p-3 text-sm transition hover:border-neutral-400 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
              on && "border-neutral-900 ring-1 ring-neutral-900",
            )}
          >
            <input
              type="radio"
              name={name}
              value={a}
              checked={on}
              onChange={() => onChange(a)}
              className="sr-only"
            />
            <span className="flex items-center gap-2 font-medium text-neutral-900">
              <Icon className="size-4" aria-hidden />
              {label}
            </span>
            <span className="text-xs text-neutral-500">{description}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

/** Loja do público "seguidores" (só lojas ativas). */
export function AudienceStoreSelect({
  value,
  onChange,
  error,
  disabled = false,
}: {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  error?: string;
  disabled?: boolean;
}) {
  const stores = useStoreOptions();
  return (
    <Field label="Loja" required error={error}>
      <Select
        placeholder={stores.isLoading ? "Carregando lojas…" : "Escolha a loja"}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
      >
        {(stores.data ?? []).map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Quantas pessoas recebem, calculado pela API para o público escolhido. */
export function AudienceEstimate({
  audience,
  storeId,
}: {
  audience: NotificationAudience;
  storeId: string | null | undefined;
}) {
  const estimate = useAudienceEstimate(audience, storeId ?? undefined);
  const waitingStore = audience === "store_followers" && !storeId;
  return (
    <div
      aria-live="polite"
      className="flex items-center gap-3 rounded-2xl bg-neutral-900/[0.05] px-4 py-3"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
        <Users className="size-4" aria-hidden />
      </span>
      <p className="text-sm text-neutral-600">
        {waitingStore ? (
          "Escolha a loja para estimar o público."
        ) : estimate.isLoading ? (
          <span className="inline-flex items-center gap-2">
            <Spinner /> Calculando o público…
          </span>
        ) : estimate.error ? (
          "Não deu para estimar o público agora."
        ) : estimate.data !== undefined ? (
          <>
            Chega a cerca de{" "}
            <b className="text-base font-semibold text-neutral-900 tabular-nums">
              {formatNumber(estimate.data)}
            </b>{" "}
            {estimate.data === 1 ? "pessoa" : "pessoas"}
            {estimate.isFetching && <span className="sr-only"> (atualizando)</span>}
          </>
        ) : null}
      </p>
    </div>
  );
}

/** Texto para a confirmação de envio ("cerca de 1.234 pessoas"). */
export function useAudienceSummary(
  audience: NotificationAudience,
  storeId: string | null | undefined,
): string {
  const estimate = useAudienceEstimate(audience, storeId ?? undefined);
  return estimate.data === undefined
    ? "o público escolhido"
    : `cerca de ${plural(estimate.data, "pessoa", "pessoas")}`;
}
