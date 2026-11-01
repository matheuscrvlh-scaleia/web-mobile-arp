import { type Campaign, replaceTiersBodySchema } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Gift, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import { plural } from "@/shared/lib/format";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  FormError,
  IconButton,
  IconPicker,
  Input,
  SaveBar,
  toast,
} from "@/shared/ui";
import { useReplaceTiers } from "../api";
import { daysLeft } from "../lib/period";
import { ProgressHero } from "./ProgressHero";

type TiersInput = z.input<typeof replaceTiersBodySchema>;
type TiersValues = z.output<typeof replaceTiersBodySchema>;

const MAX_TIERS = 10;

function toFormValues(c: Campaign): TiersInput {
  return {
    tiers: [...c.tiers]
      .sort((a, b) => a.threshold - b.threshold)
      .map((t) => ({ threshold: t.threshold, label: t.label, icon: t.icon })),
  };
}

/**
 * Faixas de benefício (ex.: 3 selos = 10% no estacionamento). Edita a lista
 * inteira e salva tudo de uma vez (PUT substitui as faixas), em ordem de
 * selos. Ao lado, a prévia do cartão de progresso do app.
 */
export function TiersEditor({ campaign, readOnly }: { campaign: Campaign; readOnly: boolean }) {
  const replace = useReplaceTiers(campaign.id);
  const form = useForm<TiersInput, unknown, TiersValues>({
    resolver: zodResolver(replaceTiersBodySchema),
    values: useMemo(() => toFormValues(campaign), [campaign]),
    resetOptions: { keepDirtyValues: true },
  });
  const { control, register, formState } = form;
  const { errors, isDirty } = formState;
  const { fields, append, remove } = useFieldArray({ control, name: "tiers" });
  const tiers = useWatch({ control, name: "tiers" }) ?? [];
  useUnsavedChangesGuard(isDirty && !replace.isPending);

  const max = Math.max(campaign.challengesCount, ...tiers.map((t) => Number(t.threshold) || 0), 1);
  const [simulated, setSimulated] = useState(() => Math.min(1, max));
  const value = Math.min(simulated, max);

  const counts = new Map<number, number>();
  for (const t of tiers)
    counts.set(Number(t.threshold), (counts.get(Number(t.threshold)) ?? 0) + 1);

  const onSubmit = form.handleSubmit((v) => {
    const body = { tiers: [...v.tiers].sort((a, b) => a.threshold - b.threshold) };
    replace.mutate(body, {
      onSuccess: () => {
        form.reset(body);
        toast.success("Faixas salvas.");
      },
      onError: (e) => {
        if (!applyApiErrors(e, form.setError, ["tiers"])) toast.error(errorMessage(e));
      },
    });
  });

  const addTier = () => {
    const highest = Math.max(0, ...tiers.map((t) => Number(t.threshold) || 0));
    append({ threshold: Math.min(100, highest + 1), label: "", icon: "gift" });
  };

  const listError = errors.tiers?.message ?? errors.tiers?.root?.message;

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardHeader
            title="Faixas de benefício"
            description="Ao juntar N selos na campanha, o visitante ganha o benefício."
            icon={Gift}
            action={
              !readOnly && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Plus}
                  onClick={addTier}
                  disabled={fields.length >= MAX_TIERS}
                >
                  Nova faixa
                </Button>
              )
            }
          />
          <FormError message={listError} />
          {fields.length === 0 ? (
            <EmptyState
              compact
              icon={Gift}
              title="Nenhuma faixa ainda"
              description="Sem faixas, os selos valem só pela coleção."
            />
          ) : (
            <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-3">
              <legend className="sr-only">Faixas</legend>
              {fields.map((f, i) => {
                const threshold = Number(tiers[i]?.threshold);
                const repeated = (counts.get(threshold) ?? 0) > 1;
                const beyond = threshold > campaign.challengesCount;
                const rowErrors = errors.tiers?.[i];
                return (
                  <div
                    key={f.id}
                    className="grid grid-cols-[6rem_minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white/40 p-3 sm:grid-cols-[6rem_minmax(0,1fr)_14rem_auto]"
                  >
                    <Field
                      label="Selos"
                      required
                      error={
                        rowErrors?.threshold?.message ?? (repeated ? "Faixa repetida" : undefined)
                      }
                    >
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        inputMode="numeric"
                        {...register(`tiers.${i}.threshold`, { valueAsNumber: true })}
                      />
                    </Field>
                    <Field
                      label="Benefício"
                      required
                      error={rowErrors?.label?.message}
                      hint={
                        beyond && !repeated ? (
                          <span className="inline-flex items-center gap-1 text-amber-900">
                            <TriangleAlert className="size-3.5" aria-hidden />
                            Mais selos que desafios ({campaign.challengesCount})
                          </span>
                        ) : undefined
                      }
                    >
                      <Input
                        placeholder="10% OFF no estacionamento"
                        {...register(`tiers.${i}.label`)}
                      />
                    </Field>
                    <Field
                      label="Ícone"
                      required
                      error={rowErrors?.icon?.message}
                      className="col-span-2 sm:col-span-1"
                    >
                      <Controller
                        control={control}
                        name={`tiers.${i}.icon`}
                        render={({ field }) => (
                          <IconPicker
                            value={field.value}
                            onChange={field.onChange}
                            disabled={readOnly}
                          />
                        )}
                      />
                    </Field>
                    {!readOnly && (
                      <IconButton
                        icon={Trash2}
                        variant="danger"
                        label={`Remover faixa de ${tiers[i]?.threshold ?? ""} selos`}
                        onClick={() => remove(i)}
                        className="row-start-1 mt-6 sm:col-start-4"
                      />
                    )}
                  </div>
                );
              })}
            </fieldset>
          )}
          <p className="mt-4 text-xs text-neutral-500">
            Até {MAX_TIERS} faixas. A campanha tem{" "}
            {plural(campaign.challengesCount, "desafio", "desafios")}, então dá para juntar até{" "}
            {plural(campaign.challengesCount, "selo", "selos")}.
          </p>
        </Card>

        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-neutral-500">Prévia no app</p>
          <ProgressHero
            title={campaign.name}
            daysLeft={campaign.status === "published" ? daysLeft(campaign.endsAt) : null}
            tiers={tiers.map((t) => ({
              threshold: Number(t.threshold) || 0,
              label: t.label ?? "",
              icon: t.icon ?? "gift",
            }))}
            max={max}
            value={value}
          />
          <label className="flex flex-col gap-1.5 text-xs text-neutral-600">
            <span>
              Simular visitante com <b className="tabular-nums">{value}</b>{" "}
              {value === 1 ? "selo" : "selos"}
            </span>
            <input
              type="range"
              min={0}
              max={max}
              value={value}
              onChange={(e) => setSimulated(Number(e.target.value))}
              className="accent-neutral-900"
            />
          </label>
        </div>
      </div>
      {!readOnly && (
        <SaveBar
          dirty={isDirty}
          saving={replace.isPending}
          onReset={() => form.reset()}
          submitLabel="Salvar faixas"
        />
      )}
    </form>
  );
}
