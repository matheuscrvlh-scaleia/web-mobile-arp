import { type Coupon, couponToneSchema } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Send } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Controller, type UseFormReturn, useForm, useWatch } from "react-hook-form";
import { StoreSelect, useStoreOptions } from "@/features/stores";
import { useAuth } from "@/shared/auth";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";
import { formatDateTime, formatNumber, plural } from "@/shared/lib/format";
import { emptyToNull } from "@/shared/lib/text";
import {
  Card,
  DateTimeInput,
  Field,
  FieldRow,
  FormSection,
  IconPicker,
  ImageUpload,
  Input,
  SaveBar,
  Textarea,
  TonePicker,
} from "@/shared/ui";
import { useDefaultRedeemWindow } from "../api";
import type { DeadlineMode } from "../lib/deadline";
import { CouponPreview } from "./CouponPreview";
import {
  type CouponFormInput,
  type CouponFormValues,
  couponFormSchema,
  couponToFormValues,
} from "./coupon-form-schema";
import { WeekdaysPicker } from "./WeekdaysPicker";

export type CouponForm = UseFormReturn<CouponFormInput, unknown, CouponFormValues>;
export interface CouponFormContext {
  form: CouponForm;
  /** Libera a saída da tela (depois de criar, antes de navegar). */
  allowLeave: () => void;
}

const nullable = { setValueAs: emptyToNull };
const WINDOW_PRESETS = [12, 24, 48, 72];
const DESCRIPTION_MAX = 600;
const PRESET_CLASS =
  "h-8 cursor-pointer rounded-full border border-neutral-200 bg-white px-3 text-xs text-neutral-700 transition hover:border-neutral-400 aria-pressed:border-neutral-900 aria-pressed:bg-neutral-900 aria-pressed:text-white";

const DEADLINE_OPTIONS: { value: DeadlineMode; label: string; hint: string }[] = [
  {
    value: "hours",
    label: "Algumas horas depois de pegar",
    hint: "Cada visitante tem o mesmo tempo, contado de quando pegou. Não usou? O cupom volta.",
  },
  {
    value: "date",
    label: "Até uma data fixa",
    hint: "Todo mundo usa até o mesmo dia, não importa quando pegou.",
  },
  {
    value: "end",
    label: "Até o fim da promoção",
    hint: "Vale enquanto a promoção estiver no ar (precisa da data de fim).",
  },
];

/**
 * Criar, duplicar e editar promoção, com a prévia do cartão como aparece no
 * app ao lado. Na criação, a barra tem "Salvar rascunho" e "Publicar"
 * ("Agendar" com início no futuro); quem usa decide o que enviar (criar manda
 * tudo, editar só o que mudou).
 */
export function CouponForm({
  coupon,
  source,
  onSubmit,
  saving,
}: {
  /** Editar esta promoção. */
  coupon?: Coupon;
  /** Duplicar: começa com os dados dela (título "(cópia)", rascunho, datas a revisar). */
  source?: Coupon;
  onSubmit: (values: CouponFormValues, ctx: CouponFormContext) => void;
  /** Qual botão está salvando (o outro fica parado). */
  saving: "draft" | "active" | "save" | null;
}) {
  const creating = !coupon;
  const { user } = useAuth();
  const merchantStore = user?.store ?? null;
  const defaultWindow = useDefaultRedeemWindow();
  // Padrão "agora" (no minuto): o botão diz "Publicar"; com data futura, "Agendar".
  const [startsAt] = useState(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    return d.toISOString();
  });
  const form: CouponForm = useForm<CouponFormInput, unknown, CouponFormValues>({
    resolver: zodResolver(couponFormSchema),
    values: useMemo(
      () =>
        couponToFormValues(
          coupon ?? source,
          {
            storeId: merchantStore?.id ?? "",
            startsAt,
            redeemWindowHours: defaultWindow.hours,
          },
          Boolean(source && !coupon),
        ),
      [coupon, source, merchantStore?.id, startsAt, defaultWindow.hours],
    ),
    resetOptions: { keepDirtyValues: true },
  });
  const { register, control, formState, setValue } = form;
  const { errors, isDirty } = formState;
  const { allowLeave } = useUnsavedChangesGuard((isDirty || Boolean(source)) && !saving);
  const stores = useStoreOptions();
  const values = useWatch({ control });
  const storeIds = values.storeIds ?? [];
  const store = (stores.data ?? []).find((s) => s.id === storeIds[0]);
  const many = storeIds.length > 1;
  const claimed = coupon ? coupon.stock.waiting + coupon.stock.redeemed : 0;
  const deadline = values.deadline ?? "hours";
  const future = Boolean(values.startsAt && new Date(values.startsAt).getTime() > Date.now());

  const pickHours = (h: number) =>
    setValue("redeemWindowHours", h, { shouldDirty: true, shouldValidate: true });

  const send = (status: "draft" | "active") => {
    if (creating) setValue("status", status);
    return form.handleSubmit((v) => onSubmit(v, { form, allowLeave }))();
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send("active");
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card padding="lg">
          <FormSection
            title={creating && !merchantStore ? "Lojas" : "Loja"}
            description={
              creating && !merchantStore
                ? "De quem é a promoção. Escolha várias para criar uma promoção igual em cada loja (ex.: Black Friday)."
                : "A loja da promoção não muda. Para outra loja, duplique."
            }
          >
            {merchantStore || !creating ? (
              <p className="text-sm font-medium text-neutral-900">
                {coupon?.store.name ?? merchantStore?.name}
              </p>
            ) : (
              <Field
                label="Lojas"
                required
                error={errors.storeIds?.message}
                hint={
                  many
                    ? `Serão criadas ${storeIds.length} promoções iguais, uma por loja.`
                    : "Pode escolher mais de uma."
                }
              >
                <Controller
                  control={control}
                  name="storeIds"
                  render={({ field }) => (
                    <StoreSelect
                      multiple
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  )}
                />
              </Field>
            )}
          </FormSection>

          <FormSection
            title="Cartão"
            description="O que o visitante vê na lista de cupons. Veja a prévia ao lado."
          >
            <FieldRow>
              <Field
                label="Destaque"
                required
                hint="Grande no cartão: R$ 5, 15%, Grátis, 1 + 1."
                action={`${(values.headline ?? "").length}/16`}
                error={errors.headline?.message}
              >
                <Input autoFocus={creating && !source} maxLength={16} {...register("headline")} />
              </Field>
              <Field
                label="Complemento"
                optional
                hint="Ao lado do destaque: o chopp, OFF."
                error={errors.headlineSub?.message}
              >
                <Input maxLength={24} {...register("headlineSub", nullable)} />
              </Field>
            </FieldRow>
            <Field label="Título" required error={errors.title?.message}>
              <Input maxLength={120} placeholder="Chopp de R$ 10 por R$ 5" {...register("title")} />
            </Field>
            <Field label="Tom" required error={errors.tone?.message}>
              <Controller
                control={control}
                name="tone"
                render={({ field }) => (
                  <TonePicker
                    value={field.value}
                    onChange={field.onChange}
                    options={couponToneSchema.options}
                  />
                )}
              />
            </Field>
            <FieldRow>
              <Field
                label="Ícone"
                required
                hint="Aparece no canhoto quando não há foto."
                error={errors.icon?.message}
              >
                <Controller
                  control={control}
                  name="icon"
                  render={({ field }) => (
                    <IconPicker value={field.value} onChange={field.onChange} color="#2f7d3d" />
                  )}
                />
              </Field>
              <Field label="Foto" optional error={errors.imageUrl?.message}>
                <Controller
                  control={control}
                  name="imageUrl"
                  render={({ field }) => (
                    <ImageUpload
                      label="foto da promoção"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </Field>
            </FieldRow>
          </FormSection>

          <FormSection
            title="Quando vale"
            description="Horário de Brasília. Sem fim, vale até encerrar ou acabar o estoque."
          >
            <FieldRow>
              <Field
                label="Começa em"
                required
                error={errors.startsAt?.message}
                hint={future && creating ? "No futuro: a promoção fica agendada." : undefined}
              >
                <Controller
                  control={control}
                  name="startsAt"
                  render={({ field }) => (
                    <DateTimeInput
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              </Field>
              <Field
                label="Termina em"
                optional={deadline !== "end"}
                required={deadline === "end"}
                error={errors.endsAt?.message}
              >
                <Controller
                  control={control}
                  name="endsAt"
                  render={({ field }) => (
                    <DateTimeInput
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      min={values.startsAt ?? undefined}
                    />
                  )}
                />
              </Field>
            </FieldRow>
            <Field
              label="Dias em que vale"
              required
              hint="Fora destes dias, a validação no caixa recusa o cupom."
              error={errors.weekdays?.message}
            >
              <Controller
                control={control}
                name="weekdays"
                render={({ field }) => (
                  <WeekdaysPicker value={field.value ?? []} onChange={field.onChange} />
                )}
              />
            </Field>
            <Field
              label="Quando vale (texto do app)"
              optional
              hint="Ex.: Seg a sex, 11h às 15h · Só hoje, até 23h."
              error={errors.scheduleNote?.message}
            >
              <Input maxLength={80} {...register("scheduleNote", nullable)} />
            </Field>
          </FormSection>

          <FormSection
            title="Estoque e prazo para usar"
            description="Quantos cupons liberar e até quando quem pegou pode usar no caixa."
          >
            <Field
              label={many ? "Cupons liberados por loja" : "Cupons liberados"}
              required
              hint={
                claimed > 0
                  ? `Já foram pegos ${formatNumber(claimed)}: não dá para liberar menos que isso.`
                  : many
                    ? "Cada loja recebe este estoque. Nunca passa disso."
                    : "Nunca passa disso."
              }
              error={errors.totalQuantity?.message}
              className="sm:max-w-60"
            >
              <Input
                type="number"
                inputMode="numeric"
                min={Math.max(1, claimed)}
                max={100_000}
                {...register("totalQuantity", { valueAsNumber: true })}
              />
            </Field>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-xs font-medium text-neutral-600">
                Até quando o visitante pode usar?
                <span aria-hidden className="text-red-700">
                  {" "}
                  *
                </span>
              </legend>
              {DEADLINE_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-sm transition",
                    deadline === o.value
                      ? "border-neutral-900 bg-white"
                      : "border-neutral-200 bg-white/60 hover:border-neutral-400",
                  )}
                >
                  <input
                    type="radio"
                    value={o.value}
                    {...register("deadline")}
                    className="mt-0.5 size-[1.125rem] shrink-0 cursor-pointer accent-neutral-900"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-neutral-900">{o.label}</span>
                    <span className="block text-xs text-neutral-500">{o.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {deadline === "hours" && (
              <div className="flex flex-col gap-2">
                <Field
                  label="Horas para usar"
                  required
                  hint={
                    values.expiresWithPromotion && values.endsAt
                      ? "Também para no fim da promoção (regra antiga desta promoção)."
                      : `Padrão do app: ${plural(defaultWindow.hours, "hora", "horas")}.`
                  }
                  error={errors.redeemWindowHours?.message}
                  className="sm:max-w-60"
                >
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={720}
                    {...register("redeemWindowHours", { valueAsNumber: true })}
                  />
                </Field>
                <fieldset className="flex flex-wrap items-center gap-1.5">
                  <legend className="sr-only">Prazos comuns</legend>
                  <span aria-hidden className="mr-1 text-xs text-neutral-500">
                    Comuns:
                  </span>
                  {WINDOW_PRESETS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      aria-pressed={values.redeemWindowHours === h}
                      onClick={() => pickHours(h)}
                      className={PRESET_CLASS}
                    >
                      {h} h
                    </button>
                  ))}
                </fieldset>
              </div>
            )}
            {deadline === "date" && (
              <Field
                label="Vence em"
                required
                hint="Igual ou depois do fim da promoção. Depois desta data, ninguém pega mais."
                error={errors.useUntil?.message}
                className="sm:max-w-80"
              >
                <Controller
                  control={control}
                  name="useUntil"
                  render={({ field }) => (
                    <DateTimeInput
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      min={values.endsAt ?? values.startsAt ?? undefined}
                    />
                  )}
                />
              </Field>
            )}
            {deadline === "end" && (
              <p className="flex items-center gap-2 rounded-2xl bg-neutral-900/[0.04] px-4 py-3 text-sm text-neutral-700">
                <CalendarClock className="size-4 shrink-0" aria-hidden />
                {values.endsAt
                  ? `Quem pegar usa até ${formatDateTime(values.endsAt)}, quando a promoção termina.`
                  : "Escolha em “Termina em” quando a promoção acaba."}
              </p>
            )}
          </FormSection>

          <FormSection title="Detalhes" description="Regras da oferta e a economia do visitante.">
            <Field
              label="Descrição"
              optional
              hint="O caixa vê estas regras ao validar."
              action={`${formatNumber((values.description ?? "").length)}/${DESCRIPTION_MAX}`}
              error={errors.description?.message}
            >
              <Textarea
                rows={3}
                maxLength={DESCRIPTION_MAX}
                {...register("description", nullable)}
              />
            </Field>
            <Field
              label="Economia por uso (R$)"
              optional
              hint="Soma no “você economizou” do visitante e no relatório. Ex.: 5,00."
              error={errors.savings?.message}
              className="sm:max-w-60"
            >
              <Input inputMode="decimal" placeholder="0,00" {...register("savings")} />
            </Field>
          </FormSection>
        </Card>

        <aside aria-label="Prévia no app" className="xl:sticky xl:top-6 xl:self-start">
          <CouponPreview
            data={{
              storeName:
                store?.name ??
                coupon?.store.name ??
                merchantStore?.name ??
                source?.store.name ??
                "",
              storeIcon: store?.icon ?? coupon?.store.icon ?? "store",
              headline: values.headline ?? "",
              headlineSub: values.headlineSub ?? null,
              title: values.title ?? "",
              tone: values.tone ?? "green",
              icon: values.icon ?? "ticket-percent",
              imageUrl: values.imageUrl ?? null,
              redeemWindowHours: Number.isFinite(values.redeemWindowHours)
                ? (values.redeemWindowHours ?? 0)
                : 0,
              useUntil:
                deadline === "date"
                  ? (values.useUntil ?? null)
                  : deadline === "end"
                    ? (values.endsAt ?? null)
                    : null,
              total: Number.isFinite(values.totalQuantity) ? (values.totalQuantity ?? 0) : 0,
              remaining: Math.max(
                0,
                (Number.isFinite(values.totalQuantity) ? (values.totalQuantity ?? 0) : 0) - claimed,
              ),
            }}
            scheduleNote={values.scheduleNote ?? null}
          />
        </aside>
      </div>
      {creating ? (
        <SaveBar
          besidePreview
          alwaysVisible
          dirty={isDirty}
          saving={saving === "active"}
          submitIcon={future ? CalendarClock : Send}
          submitLabel={
            future && values.startsAt
              ? `Agendar para ${formatDateTime(values.startsAt)}`
              : many
                ? `Publicar ${storeIds.length}`
                : "Publicar"
          }
          secondary={{
            label: many ? `Salvar ${storeIds.length} rascunhos` : "Salvar rascunho",
            onClick: () => void send("draft"),
            loading: saving === "draft",
          }}
        />
      ) : (
        <SaveBar
          besidePreview
          dirty={isDirty}
          saving={saving === "save"}
          onReset={() => form.reset()}
          submitLabel="Salvar alterações"
        />
      )}
    </form>
  );
}
