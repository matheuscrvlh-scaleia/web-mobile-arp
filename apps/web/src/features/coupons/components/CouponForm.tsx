import { type Coupon, couponToneSchema } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, type UseFormReturn, useForm, useWatch } from "react-hook-form";
import { useStoreOptions } from "@/features/stores";
import { useAuth } from "@/shared/auth";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import { nextRoundedNow } from "@/shared/lib/dates";
import { formatNumber, plural } from "@/shared/lib/format";
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
  Segmented,
  Select,
  Textarea,
  TonePicker,
} from "@/shared/ui";
import { useDefaultRedeemWindow } from "../api";
import { CouponPreview } from "./CouponPreview";
import {
  type CouponFormInput,
  type CouponFormValues,
  couponFormSchema,
  couponToFormValues,
} from "./coupon-form-schema";

export type CouponForm = UseFormReturn<CouponFormInput, unknown, CouponFormValues>;
export interface CouponFormContext {
  form: CouponForm;
  /** Libera a saída da tela (depois de criar, antes de navegar). */
  allowLeave: () => void;
}

const nullable = { setValueAs: emptyToNull };
const WINDOW_PRESETS = [12, 24, 48, 72];
const DESCRIPTION_MAX = 600;

/**
 * Criar e editar promoção, com a prévia do cartão como aparece no app ao
 * lado. Valida com o schema do contrato; quem usa decide o que enviar
 * (criar manda tudo, editar só o que mudou).
 */
export function CouponForm({
  coupon,
  onSubmit,
  saving,
  submitLabel,
}: {
  coupon?: Coupon;
  onSubmit: (values: CouponFormValues, ctx: CouponFormContext) => void;
  saving: boolean;
  submitLabel: string;
}) {
  const creating = !coupon;
  const { user } = useAuth();
  const merchantStore = user?.store ?? null;
  const defaultWindow = useDefaultRedeemWindow();
  const [startsAt] = useState(() => nextRoundedNow(15));
  const form: CouponForm = useForm<CouponFormInput, unknown, CouponFormValues>({
    resolver: zodResolver(couponFormSchema),
    values: useMemo(
      () =>
        couponToFormValues(coupon, {
          storeId: merchantStore?.id ?? "",
          startsAt,
          redeemWindowHours: defaultWindow.hours,
        }),
      [coupon, merchantStore?.id, startsAt, defaultWindow.hours],
    ),
    resetOptions: { keepDirtyValues: true },
  });
  const { register, control, formState, setValue } = form;
  const { errors, isDirty } = formState;
  const { allowLeave } = useUnsavedChangesGuard(isDirty && !saving);
  const stores = useStoreOptions();
  const values = useWatch({ control });
  const store = (stores.data ?? []).find((s) => s.id === values.storeId);
  const claimed = coupon ? coupon.stock.waiting + coupon.stock.redeemed : 0;

  return (
    <form onSubmit={form.handleSubmit((v) => onSubmit(v, { form, allowLeave }))} noValidate>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card padding="lg">
          <FormSection
            title="Loja"
            description={
              creating
                ? "De quem é a promoção. Depois de criada, a loja não muda."
                : "A loja da promoção não muda."
            }
          >
            {merchantStore || !creating ? (
              <p className="text-sm font-medium text-neutral-900">
                {coupon?.store.name ?? merchantStore?.name}
              </p>
            ) : (
              <Field label="Loja" required error={errors.storeId?.message}>
                <Select placeholder="Escolha a loja" {...register("storeId")}>
                  {(stores.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {creating && (
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Field
                    label="Ao salvar"
                    hint={
                      field.value === "active"
                        ? "Aparece no app a partir do início."
                        : "Fica guardada; ative quando quiser."
                    }
                  >
                    <Segmented
                      label="Ao salvar"
                      size="sm"
                      value={field.value ?? "draft"}
                      onChange={field.onChange}
                      options={[
                        { value: "draft", label: "Guardar rascunho" },
                        { value: "active", label: "Publicar" },
                      ]}
                    />
                  </Field>
                )}
              />
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
                <Input autoFocus={creating} maxLength={16} {...register("headline")} />
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
            title="Estoque e prazo"
            description="Quantos cupons liberar e quanto tempo o visitante tem para usar depois de pegar. Não usou? O cupom volta."
          >
            <FieldRow>
              <Field
                label="Cupons liberados"
                required
                hint={
                  claimed > 0
                    ? `Já foram pegos ${formatNumber(claimed)}: não dá para liberar menos que isso.`
                    : "Nunca passa disso."
                }
                error={errors.totalQuantity?.message}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={Math.max(1, claimed)}
                  max={100_000}
                  {...register("totalQuantity", { valueAsNumber: true })}
                />
              </Field>
              <Field
                label="Horas para usar"
                required
                hint={`Padrão do app: ${plural(defaultWindow.hours, "hora", "horas")}.`}
                error={errors.redeemWindowHours?.message}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={720}
                  {...register("redeemWindowHours", { valueAsNumber: true })}
                />
              </Field>
            </FieldRow>
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
                  onClick={() =>
                    setValue("redeemWindowHours", h, { shouldDirty: true, shouldValidate: true })
                  }
                  className="h-8 cursor-pointer rounded-full border border-neutral-200 bg-white px-3 text-xs text-neutral-700 transition hover:border-neutral-400 aria-pressed:border-neutral-900 aria-pressed:bg-neutral-900 aria-pressed:text-white"
                >
                  {h} h
                </button>
              ))}
            </fieldset>
          </FormSection>

          <FormSection
            title="Quando vale"
            description="Horário de Brasília. Sem fim, vale até encerrar ou acabar o estoque."
          >
            <FieldRow>
              <Field label="Começa em" required error={errors.startsAt?.message}>
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
              <Field label="Termina em" optional error={errors.endsAt?.message}>
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
              label="Quando vale (texto do app)"
              optional
              hint="Ex.: Seg a sex, 11h às 15h · Só hoje, até 23h."
              error={errors.scheduleNote?.message}
            >
              <Input maxLength={80} {...register("scheduleNote", nullable)} />
            </Field>
          </FormSection>

          <FormSection title="Detalhes" description="Regras da oferta e a economia do visitante.">
            <Field
              label="Descrição"
              optional
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
              hint="Soma no “você economizou” do visitante. Ex.: 5,00."
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
              storeName: store?.name ?? coupon?.store.name ?? merchantStore?.name ?? "",
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
      <SaveBar
        dirty={isDirty}
        saving={saving}
        alwaysVisible={creating}
        onReset={creating ? undefined : () => form.reset()}
        submitLabel={submitLabel}
      />
    </form>
  );
}
