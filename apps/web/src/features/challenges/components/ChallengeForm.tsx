import {
  type Challenge,
  challengeValidationSchema,
  createChallengeBodySchema,
} from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { Controller, type UseFormReturn, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { useCampaigns } from "@/features/campaigns";
import { SealBadge, useSeals } from "@/features/seals";
import { useStoreOptions } from "@/features/stores";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import { formatNumber } from "@/shared/lib/format";
import {
  Card,
  Field,
  FieldRow,
  FormSection,
  IconPicker,
  Input,
  SaveBar,
  Segmented,
  Select,
  Switch,
  Textarea,
} from "@/shared/ui";
import { ChallengeAppRow } from "./ChallengeAppRow";
import { VALIDATION } from "./ChallengeBadges";
import { EventSelect } from "./EventSelect";

export const challengeFormSchema = createChallengeBodySchema;
export type ChallengeFormInput = z.input<typeof challengeFormSchema>;
export type ChallengeFormValues = z.output<typeof challengeFormSchema>;
export type ChallengeFormApi = UseFormReturn<ChallengeFormInput, unknown, ChallengeFormValues>;
export interface ChallengeFormContext {
  form: ChallengeFormApi;
  allowLeave: () => void;
}

export const CHALLENGE_FORM_FIELDS = Object.keys(challengeFormSchema.shape);

export function challengeToFormValues(
  c: Challenge | undefined,
  campaignId: string | undefined,
): ChallengeFormInput {
  return {
    campaignId: c?.campaign.id ?? campaignId ?? "",
    sealId: c?.seal.id ?? "",
    title: c?.title ?? "",
    howTo: c?.howTo ?? "",
    icon: c?.icon ?? "award",
    validation: c?.validation ?? "qr",
    storeId: c?.store?.id ?? null,
    product: c?.product ?? null,
    eventId: c?.event?.id ?? null,
    sortOrder: c?.sortOrder ?? 0,
    status: c?.status ?? "active",
  };
}

const HOW_TO_MAX = 240;

/**
 * Desafio (criar e editar). No editar, a campanha não muda (fica só
 * para leitura e não entra no PATCH, que só leva o que mudou).
 */
export function ChallengeForm({
  challenge,
  campaignId,
  onSubmit,
  saving,
  readOnly = false,
  submitLabel,
}: {
  challenge?: Challenge;
  /** Campanha escolhida na lista (criar). */
  campaignId?: string;
  onSubmit: (values: ChallengeFormValues, ctx: ChallengeFormContext) => void;
  saving: boolean;
  readOnly?: boolean;
  submitLabel: string;
}) {
  const creating = !challenge;
  const form: ChallengeFormApi = useForm<ChallengeFormInput, unknown, ChallengeFormValues>({
    resolver: zodResolver(challengeFormSchema),
    values: useMemo(() => challengeToFormValues(challenge, campaignId), [challenge, campaignId]),
    resetOptions: { keepDirtyValues: true },
  });
  const { register, control, formState } = form;
  const { errors, isDirty } = formState;
  const { allowLeave } = useUnsavedChangesGuard(isDirty && !saving);

  const campaigns = useCampaigns({ enabled: creating });
  const seals = useSeals();
  const stores = useStoreOptions();
  const [title, howTo, icon, sealId, validation] = useWatch({
    control,
    name: ["title", "howTo", "icon", "sealId", "validation"],
  });
  const sealList = seals.data ?? [];
  const selectedSeal = sealList.find((s) => s.id === sealId) ?? null;
  // Selo arquivado continua na lista se já é o do desafio.
  const sealOptions = sealList.filter((s) => s.status === "active" || s.id === sealId);

  return (
    <form onSubmit={form.handleSubmit((v) => onSubmit(v, { form, allowLeave }))} noValidate>
      <fieldset disabled={readOnly} className="min-w-0">
        <Card padding="lg">
          <FormSection title="Desafio" description="Como aparece na lista de desafios do app.">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="flex flex-col gap-4">
                {creating ? (
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
                  <Field label="Campanha" hint="A campanha de um desafio não muda.">
                    <Input value={challenge.campaign.name} disabled readOnly />
                  </Field>
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
            description="O selo que o visitante ganha e como o desafio é comprovado."
          >
            <Field label="Selo" required error={errors.sealId?.message}>
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
                      placeholder={seals.isLoading ? "Carregando selos…" : "Escolha o selo"}
                      className="flex-1"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    >
                      {sealOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.status === "archived" ? " (arquivado)" : ""}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </div>
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
                    onChange={field.onChange}
                    options={challengeValidationSchema.options.map((v) => ({
                      value: v,
                      label: VALIDATION[v].label,
                      icon: VALIDATION[v].icon,
                    }))}
                  />
                )}
              />
            </Field>
          </FormSection>

          <FormSection
            title="Ligações"
            description="Opcional: a loja onde o desafio acontece ou o evento que vale o selo."
          >
            <FieldRow>
              <Field label="Loja" optional error={errors.storeId?.message}>
                <Controller
                  control={control}
                  name="storeId"
                  render={({ field }) => (
                    <Select
                      placeholder="Nenhuma (ARP)"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      onBlur={field.onBlur}
                    >
                      {(stores.data ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
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
                      current={challenge?.event ?? null}
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
          </FormSection>

          <FormSection title="Exibição" description="Ordem na lista do app e se aparece.">
            <FieldRow>
              <Field label="Ordem" hint="Menor aparece primeiro" error={errors.sortOrder?.message}>
                <Input
                  type="number"
                  min={0}
                  max={999}
                  inputMode="numeric"
                  {...register("sortOrder", { valueAsNumber: true })}
                />
              </Field>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <div className="flex items-end pb-1">
                    <Switch
                      checked={field.value !== "inactive"}
                      onCheckedChange={(on) => field.onChange(on ? "active" : "inactive")}
                      label="Desafio ativo"
                      description="Inativo some do app e os QR Codes dele param de dar selo."
                      disabled={readOnly}
                    />
                  </div>
                )}
              />
            </FieldRow>
          </FormSection>
        </Card>
      </fieldset>
      {!readOnly && (
        <SaveBar
          dirty={isDirty}
          saving={saving}
          alwaysVisible={creating}
          onReset={creating ? undefined : () => form.reset()}
          submitLabel={submitLabel}
        />
      )}
    </form>
  );
}
