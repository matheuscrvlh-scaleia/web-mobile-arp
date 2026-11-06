import { type NotificationAudience, notificationAudienceSchema } from "@arp/contracts";
import { TriangleAlert, Users } from "lucide-react";
import { useId } from "react";
import { useEvent } from "@/features/events";
import { EventPicker } from "@/features/highlights";
import { StoreSelect } from "@/features/stores";
import { cn } from "@/shared/lib/cn";
import { formatNumber, plural } from "@/shared/lib/format";
import { Field, Spinner } from "@/shared/ui";
import { type AudienceQuery, audienceReady, useAudienceEstimate } from "../api";
import { AUDIENCE } from "./NotificationBadges";

/** Público: as opções com explicação (rádios nativos em cartões). */
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
    <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2" disabled={disabled}>
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

/** Loja do público "seguidores" (só lojas ativas, com busca). */
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
  return (
    <Field label="Loja" required error={error}>
      <StoreSelect value={value} onChange={onChange} disabled={disabled} />
    </Field>
  );
}

/** Evento do público "interessados no evento" (busca na agenda). */
export function AudienceEventSelect({
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
  const event = useEvent(value ?? undefined);
  return (
    <Field
      label="Evento"
      required
      hint="Recebe quem marcou “Tenho interesse” neste evento no app."
      error={error}
    >
      <EventPicker
        value={value}
        selectedLabel={event.data?.title}
        onChange={onChange}
        disabled={disabled}
      />
    </Field>
  );
}

/** O público do formulário no formato da estimativa: só a loja ou o evento que ele usa. */
const queryOf = (
  audience: NotificationAudience,
  storeId: string | null | undefined,
  eventId: string | null | undefined,
): AudienceQuery => ({
  audience,
  storeId: audience === "store_followers" ? (storeId ?? undefined) : undefined,
  eventId: audience === "event_interested" ? (eventId ?? undefined) : undefined,
});

const WAITING: Partial<Record<NotificationAudience, string>> = {
  store_followers: "Escolha a loja para estimar o público.",
  event_interested: "Escolha o evento para estimar o público.",
};

/** Quantas pessoas recebem, calculado pela API para o público escolhido. */
export function AudienceEstimate({
  audience,
  storeId,
  eventId,
}: {
  audience: NotificationAudience;
  storeId: string | null | undefined;
  eventId: string | null | undefined;
}) {
  const target = queryOf(audience, storeId, eventId);
  const estimate = useAudienceEstimate(target);
  const waiting = !audienceReady(target);
  const nobody = !waiting && estimate.data === 0;
  if (nobody) {
    return (
      <p
        aria-live="polite"
        className="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800"
      >
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <b className="font-semibold">Ninguém vai receber com esse público.</b>{" "}
          {audience === "event_interested"
            ? "Ninguém com notificações ligadas marcou interesse neste evento. Escolha outro público: "
            : "Escolha outro público: "}
          enviar e agendar ficam bloqueados até alguém poder receber.
        </span>
      </p>
    );
  }
  return (
    <div
      aria-live="polite"
      className="flex items-center gap-3 rounded-2xl bg-neutral-900/[0.05] px-4 py-3"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
        <Users className="size-4" aria-hidden />
      </span>
      <p className="text-sm text-neutral-600">
        {waiting ? (
          WAITING[audience]
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

/** Quantas pessoas recebem (undefined = ainda calculando ou falta a loja/o evento). */
export function useAudienceCount(
  audience: NotificationAudience,
  storeId: string | null | undefined,
  eventId: string | null | undefined,
): number | undefined {
  const target = queryOf(audience, storeId, eventId);
  const estimate = useAudienceEstimate(target);
  if (!audienceReady(target)) return undefined;
  return estimate.data;
}

/** "1.234 pessoas" / "1 pessoa" / "o público escolhido" (sem estimativa). */
export const peopleText = (n: number | undefined) =>
  n === undefined ? "o público escolhido" : plural(n, "pessoa", "pessoas");
