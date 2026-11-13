import {
  type Campaign,
  type Challenge,
  challengeAutoTriggerSchema,
  challengeValidationSchema,
  createChallengeBodySchema,
} from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarRange, Lock } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, type UseFormReturn, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { useCampaigns } from "@/features/campaigns";
import { MoreOptions, SealBadge, SealFormModal, useSeals } from "@/features/seals";
import { StoreSelect, useStoreOptions } from "@/features/stores";
import { copyName, useUnsavedChangesGuard } from "@/shared/hooks";
import { formatDateTime, formatNumber, plural } from "@/shared/lib/format";
import {
  Card,
  confirmar,
  DateTimeInput,
  Field,
  FieldRow,
  FormSection,
  IconPicker,
  Input,
  SaveBar,
  Segmented,
  Select,
  Textarea,
} from "@/shared/ui";
import { ChallengeAppRow } from "./ChallengeAppRow";
import { AUTO_TRIGGER, VALIDATION } from "./ChallengeBadges";
import { CouponSelect } from "./CouponSelect";
import { EventSelect } from "./EventSelect";

/** O corpo da API, mais as regras do automático (a API confere de novo). */
export const challengeFormSchema = createChallengeBodySchema.superRefine((v, ctx) => {
  if (
    v.availableFrom &&
    v.availableUntil &&
    new Date(v.availableUntil) <= new Date(v.availableFrom)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["availableUntil"],
      message: "O fim precisa ser depois do início",
    });
  }
  if (v.validation !== "auto") return;
  if (!v.autoTrigger) {
    ctx.addIssue({ code: "custom", path: ["autoTrigger"], message: "Escolha o que dá o selo" });
  } else if (v.autoTrigger === "coupon_redeemed" && !v.couponId) {
    ctx.addIssue({ code: "custom", path: ["couponId"], message: "Escolha o cupom" });
  }
});
export type ChallengeFormInput = z.input<typeof challengeFormSchema>;
export type ChallengeFormValues = z.output<typeof challengeFormSchema>;
export type ChallengeFormApi = UseFormReturn<ChallengeFormInput, unknown, ChallengeFormValues>;
export interface ChallengeFormContext {
  form: ChallengeFormApi;
  allowLeave: () => void;
}

export const CHALLENGE_FORM_FIELDS = Object.keys(createChallengeBodySchema.shape);

/** Valor do select de selo que abre o "Novo selo" (nunca é um id). */
const NEW_SEAL = "__novo__";

/**
 * Valores do formulário. `copy` = duplicar: mesmo conteúdo, título
 * "(cópia)". Status e ordem não ficam no formulário (cabeçalho e arrastar).
 */
export function challengeToFormValues(
  c: Challenge | undefined,
  campaignId: string | undefined,
  { copy = false }: { copy?: boolean } = {},
): ChallengeFormInput {
  return {
    campaignId: campaignId ?? c?.campaign.id ?? "",
    sealId: c?.seal.id ?? "",
    title: c ? (copy ? copyName(c.title).slice(0, 120) : c.title) : "",
    howTo: c?.howTo ?? "",
    icon: c?.icon ?? "award",
    validation: c?.validation ?? "qr",
    autoTrigger: c?.autoTrigger ?? null,
    couponId: c?.coupon?.id ?? null,
    storeId: c?.store?.id ?? null,
    product: c?.product ?? null,
    eventId: c?.event?.id ?? null,
    availableFrom: c?.availableFrom ?? null,
    availableUntil: c?.availableUntil ?? null,
    points: c?.points ?? null,
  };
}

/** "Vale de 1 dez às 00:00 a 31 dez às 23:59 (período da campanha)". */
function periodSummary(
  campaign: Pick<Campaign, "startsAt" | "endsAt"> | undefined,
  from: string | null | undefined,
  until: string | null | undefined,
): string | null {
  if (!campaign) return null;
  const start = from && from > campaign.startsAt ? from : campaign.startsAt;
  const end = until && until < campaign.endsAt ? until : campaign.endsAt;
  const own = (from && from > campaign.startsAt) || (until && until < campaign.endsAt);
  return `Vale de ${formatDateTime(start)} até ${formatDateTime(end)} ${own ? "(período próprio, dentro da campanha)" : "(período da campanha)"}.`;
}

const HOW_TO_MAX = 240;

/**
 * Desafio (criar, duplicar e editar). No editar, a campanha não muda (fica
 * só para leitura e não entra no PATCH, que só leva o que mudou). Loja,
 * evento, produto e período próprio ficam em "Mais opções".
 */
export function ChallengeForm({
  challenge,
  copyOf,
  campaignId,
  onSubmit,
  saving,
  readOnly = false,
  submitLabel,
}: {
  /** Editar este desafio. */
  challenge?: Challenge;
  /** Criar a partir deste (Duplicar). */
  copyOf?: Challenge;
  /** Campanha escolhida na lista (criar). */
  campaignId?: string;
  onSubmit: (values: ChallengeFormValues, ctx: ChallengeFormContext) => void;
  saving: boolean;
  readOnly?: boolean;
  submitLabel: string;
}) {
  const creating = !challenge;
  const source = challenge ?? copyOf;
  const form: ChallengeFormApi = useForm<ChallengeFormInput, unknown, ChallengeFormValues>({
    resolver: zodResolver(challengeFormSchema),
    values: useMemo(
      () => challengeToFormValues(source, campaignId, { copy: Boolean(copyOf) }),
      [source, campaignId, copyOf],
    ),
    resetOptions: { keepDirtyValues: true },
  });
  const { register, control, formState } = form;
  const { errors, isDirty } = formState;
  const { allowLeave } = useUnsavedChangesGuard(isDirty && !saving);
  const [creatingSeal, setCreatingSeal] = useState(false);

  const campaigns = useCampaigns();
  const seals = useSeals();
  const stores = useStoreOptions();
  const [
    title,
    howTo,
    icon,
    sealId,
    validation,
    autoTrigger,
    couponId,
    campaignIdValue,
    storeId,
    availableFrom,
    availableUntil,
  ] = useWatch({
    control,
    name: [
      "title",
      "howTo",
      "icon",
      "sealId",
      "validation",
      "autoTrigger",
      "couponId",
      "campaignId",
      "storeId",
      "availableFrom",
      "availableUntil",
    ],
  });
  const sealList = seals.data ?? [];
  const selectedSeal = sealList.find((s) => s.id === sealId) ?? null;
  // Gatilho de cupom: a loja do desafio é a do cupom (a API confere).
  const couponTrigger = validation === "auto" && autoTrigger === "coupon_redeemed";
  const campaign = (campaigns.data ?? []).find((c) => c.id === campaignIdValue);
  const campaignName = campaign?.name ?? challenge?.campaign.name;
  const couponStoreName = (stores.data ?? []).find((s) => s.id === storeId)?.name;
  // Selo arquivado continua na lista se já é o do desafio.
  const sealOptions = sealList.filter((s) => s.status === "active" || s.id === sealId);
  // Quem já ganhou ficou com este selo: trocar deixaria o histórico com outro.
  const sealLocked = Boolean(challenge && challenge.completionsCount > 0);
  const summary = periodSummary(campaign, availableFrom, availableUntil);
  const extras = [
    storeId && !couponTrigger && "loja",
    form.getValues("eventId") && "evento",
    form.getValues("product") && "produto",
    (availableFrom || availableUntil) && "período próprio",
  ].filter(Boolean) as string[];
  const extrasError = Boolean(
    errors.storeId ||
      errors.eventId ||
      errors.product ||
      errors.availableFrom ||
      errors.availableUntil,
  );

  // Trocar para automático um desafio com QR Codes: eles param de dar selo.
  const onValidationChange = async (next: "qr" | "auto", apply: (v: "qr" | "auto") => void) => {
    if (
      next === "auto" &&
      challenge?.validation === "qr" &&
      challenge.qrCodesCount > 0 &&
      !(await confirmar({
        title: `Trocar "${challenge.title}" para automático?`,
        description: `${plural(challenge.qrCodesCount, "QR Code deste desafio deixa", "QR Codes deste desafio deixam")} de dar selo quando você salvar. Cartazes impressos param de valer.`,
        confirmLabel: "Trocar para automático",
        cancelLabel: "Manter QR Code",
      }))
    )
      return;
    apply(next);
  };

  return (
    <>
      <form onSubmit={form.handleSubmit((v) => onSubmit(v, { form, allowLeave }))} noValidate>
        <fieldset disabled={readOnly} className="min-w-0">
          <Card padding="lg">
            <FormSection title="Desafio" description="Como aparece na lista de desafios do app.">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="flex flex-col gap-4">
                  {creating && !campaignId ? (
                    <Field label="Campanha" required error={errors.campaignId?.message}>
                      <Controller
                        control={control}
                        name="campaignId"
                        render={({ field }) => (
                          <Select
                            placeholder="Escolha a campanha"
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                          >
                            {(campaigns.data ?? [])
                              .filter((c) => c.status !== "archived")
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                          </Select>
                        )}
                      />
                    </Field>
                  ) : (
                    <p className="text-sm text-neutral-600">
                      Campanha <strong className="font-semibold">{campaignName ?? "…"}</strong>
                      {!creating && (
                        <span className="text-neutral-500">
                          {" "}
                          · a campanha de um desafio não muda
                        </span>
                      )}
                    </p>
                  )}
                  {summary && (
                    <p className="flex items-start gap-2 rounded-2xl bg-neutral-900/[0.04] px-3 py-2 text-xs text-neutral-600">
                      <CalendarRange className="mt-px size-3.5 shrink-0" aria-hidden />
                      {summary}
                    </p>
                  )}
                  <Field
                    label="Título"
                    required
                    hint="Ex.: Faça o tour da ARP"
                    error={errors.title?.message}
                  >
                    <Input autoFocus={creating} {...register("title")} />
                  </Field>
                  <Field
                    label="Como cumprir"
                    required
                    hint="Onde está o QR Code ou o que fazer. Ex.: QR Code no fim do tour, na praça central"
                    action={`${formatNumber((howTo ?? "").length)}/${HOW_TO_MAX}`}
                    error={errors.howTo?.message}
                  >
                    <Textarea rows={2} maxLength={HOW_TO_MAX} {...register("howTo")} />
                  </Field>
                  <Field label="Ícone" required error={errors.icon?.message}>
                    <Controller
                      control={control}
                      name="icon"
                      render={({ field }) => (
                        <IconPicker
                          value={field.value}
                          onChange={field.onChange}
                          disabled={readOnly}
                        />
                      )}
                    />
                  </Field>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-neutral-500">Prévia no app</p>
                  <ChallengeAppRow
                    icon={icon}
                    title={title}
                    howTo={howTo}
                    seal={selectedSeal}
                    validation={validation}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Selo e validação"
              description="A categoria do selo que o visitante ganha, quantos Trevos ele dá e como o desafio é comprovado. Cada desafio dá o selo uma vez por pessoa."
            >
              <Field
                label="Categoria do selo"
                required
                hint={
                  sealLocked
                    ? `Já deu ${plural(challenge?.completionsCount ?? 0, "selo", "selos")}: quem ganhou ficou com o selo ${selectedSeal?.name ?? "atual"}. Para outro selo, crie outro desafio.`
                    : "Não achou? Escolha “+ Criar categoria nova…” no fim da lista."
                }
                error={errors.sealId?.message}
              >
                <div className="flex items-center gap-3">
                  {selectedSeal ? (
                    <SealBadge seal={selectedSeal} size="sm" />
                  ) : (
                    <span
                      aria-hidden
                      className="size-10 shrink-0 rounded-full bg-neutral-900/[0.06]"
                    />
                  )}
                  <Controller
                    control={control}
                    name="sealId"
                    render={({ field }) => (
                      <Select
                        placeholder={
                          seals.isLoading ? "Carregando categorias…" : "Escolha a categoria"
                        }
                        className="flex-1"
                        disabled={sealLocked}
                        value={field.value}
                        onChange={(e) => {
                          if (e.target.value === NEW_SEAL) setCreatingSeal(true);
                          else field.onChange(e);
                        }}
                        onBlur={field.onBlur}
                      >
                        {sealOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                            {s.status === "archived" ? " (arquivado)" : ""}
                          </option>
                        ))}
                        <option value={NEW_SEAL}>+ Criar categoria nova…</option>
                      </Select>
                    )}
                  />
                  {sealLocked && <Lock className="size-4 shrink-0 text-neutral-400" aria-hidden />}
                </div>
              </Field>
              <Field
                label="Trevos do selo"
                optional
                hint={
                  selectedSeal
                    ? `Vazio = ${plural(selectedSeal.points, "Trevo", "Trevos")}, o padrão da categoria ${selectedSeal.name}.`
                    : "Vazio = o padrão da categoria."
                }
                error={errors.points?.message}
                className="max-w-xs"
              >
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  placeholder={selectedSeal ? String(selectedSeal.points) : undefined}
                  {...register("points", {
                    setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                  })}
                />
              </Field>
              <Field
                label="Validação"
                required
                hint={VALIDATION[validation].hint}
                error={errors.validation?.message}
              >
                <Controller
                  control={control}
                  name="validation"
                  render={({ field }) => (
                    <Segmented
                      label="Validação"
                      value={field.value}
                      onChange={(v) => void onValidationChange(v, field.onChange)}
                      options={challengeValidationSchema.options.map((v) => ({
                        value: v,
                        label: VALIDATION[v].label,
                        icon: VALIDATION[v].icon,
                      }))}
                    />
                  )}
                />
              </Field>
              {validation === "auto" && (
                <Field
                  label="O que dá o selo"
                  required
                  hint={autoTrigger ? AUTO_TRIGGER[autoTrigger].hint : undefined}
                  error={errors.autoTrigger?.message}
                >
                  <Controller
                    control={control}
                    name="autoTrigger"
                    render={({ field }) => (
                      <Segmented
                        label="O que dá o selo"
                        value={field.value ?? undefined}
                        onChange={field.onChange}
                        options={challengeAutoTriggerSchema.options.map((t) => ({
                          value: t,
                          label: AUTO_TRIGGER[t].label,
                          icon: AUTO_TRIGGER[t].icon,
                        }))}
                      />
                    )}
                  />
                </Field>
              )}
              {couponTrigger && (
                <>
                  <Field label="Cupom" required error={errors.couponId?.message}>
                    <Controller
                      control={control}
                      name="couponId"
                      render={({ field }) => (
                        <CouponSelect
                          value={field.value}
                          current={source?.coupon ?? null}
                          onBlur={field.onBlur}
                          disabled={readOnly}
                          onChange={(coupon) => {
                            field.onChange(coupon?.id ?? null);
                            if (coupon)
                              form.setValue("storeId", coupon.storeId, { shouldDirty: true });
                          }}
                        />
                      )}
                    />
                  </Field>
                  {couponId && (
                    <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900">
                      Cupom vinculado à campanha <strong>{campaignName ?? "escolhida"}</strong>:
                      quando {couponStoreName ? <strong>{couponStoreName}</strong> : "a loja"} der
                      baixa nele no caixa, o visitante ganha o selo{" "}
                      <strong>{selectedSeal?.name ?? "do desafio"}</strong>
                      {selectedSeal?.repeatable ? " a cada baixa" : " (uma vez por pessoa)"},
                      enquanto a campanha estiver no ar.
                    </p>
                  )}
                </>
              )}
            </FormSection>

            <FormSection
              title="Loja, evento e período"
              description="Opcional. Quase sempre fica vazio: o desafio vale para todo o shopping, no período da campanha."
            >
              <MoreOptions
                summary={
                  extras.length > 0
                    ? `Preenchido: ${extras.join(", ")}`
                    : "Nada preenchido: vale para todo o shopping, no período da campanha"
                }
                defaultOpen={extras.length > 0}
                forceOpen={extrasError}
              >
                <FieldRow>
                  <Field
                    label="Loja"
                    optional
                    hint={couponTrigger ? "Vem do cupom escolhido." : undefined}
                    error={errors.storeId?.message}
                  >
                    <Controller
                      control={control}
                      name="storeId"
                      render={({ field }) => (
                        <StoreSelect
                          placeholder="Nenhuma (vale para todo o shopping)"
                          disabled={couponTrigger}
                          value={field.value ?? null}
                          onChange={(v) => field.onChange(v ?? null)}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                  </Field>
                  <Field label="Evento" optional error={errors.eventId?.message}>
                    <Controller
                      control={control}
                      name="eventId"
                      render={({ field }) => (
                        <EventSelect
                          value={field.value}
                          current={source?.event ?? null}
                          onChange={field.onChange}
                          disabled={readOnly}
                        />
                      )}
                    />
                  </Field>
                </FieldRow>
                <Field
                  label="Produto do parceiro"
                  optional
                  hint="Desafio de produto: o lojista da loja gera o QR e os selos entram na cobrança."
                  error={errors.product?.message}
                >
                  <Controller
                    control={control}
                    name="product"
                    render={({ field }) => (
                      <Input
                        maxLength={80}
                        placeholder="Ex.: Café coado"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                </Field>
                <p className="text-xs text-neutral-500">
                  Período próprio: em branco, vale o período da campanha. Antes do início o desafio
                  não aparece no app; depois do fim, o QR e o automático param de dar selo. Horário
                  de Brasília.
                </p>
                <FieldRow>
                  <Field label="Começa em" optional error={errors.availableFrom?.message}>
                    <Controller
                      control={control}
                      name="availableFrom"
                      render={({ field }) => (
                        <DateTimeInput
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                  </Field>
                  <Field label="Termina em" optional error={errors.availableUntil?.message}>
                    <Controller
                      control={control}
                      name="availableUntil"
                      render={({ field }) => (
                        <DateTimeInput
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          min={availableFrom ?? undefined}
                        />
                      )}
                    />
                  </Field>
                </FieldRow>
              </MoreOptions>
            </FormSection>
          </Card>
        </fieldset>
        {!readOnly && (
          <SaveBar
            dirty={isDirty || Boolean(copyOf)}
            saving={saving}
            alwaysVisible={creating}
            onReset={creating ? undefined : () => form.reset()}
            submitLabel={submitLabel}
          />
        )}
      </form>
      {/* Fora do <form>: o submit do selo não pode subir para o do desafio (portal). */}
      {creatingSeal && (
        <SealFormModal
          nextOrder={Math.min(999, Math.max(-1, ...sealList.map((s) => s.sortOrder)) + 1)}
          readOnly={false}
          onClose={() => setCreatingSeal(false)}
          onSaved={(seal) =>
            form.setValue("sealId", seal.id, { shouldDirty: true, shouldValidate: true })
          }
        />
      )}
    </>
  );
}
