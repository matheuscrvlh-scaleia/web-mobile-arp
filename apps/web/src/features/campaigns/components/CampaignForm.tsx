import { type Campaign, createCampaignBodySchema } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { Controller, type UseFormReturn, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import { addMonths, currentMonth, fromZonedInput, monthBounds } from "@/shared/lib/dates";
import { formatNumber } from "@/shared/lib/format";
import { emptyToNull } from "@/shared/lib/text";
import {
  Card,
  DateTimeInput,
  Field,
  FieldRow,
  FormSection,
  Input,
  SaveBar,
  Textarea,
} from "@/shared/ui";

export const campaignFormSchema = createCampaignBodySchema;
export type CampaignFormInput = z.input<typeof campaignFormSchema>;
export type CampaignFormValues = z.output<typeof campaignFormSchema>;
export type CampaignFormApi = UseFormReturn<CampaignFormInput, unknown, CampaignFormValues>;
export interface CampaignFormContext {
  form: CampaignFormApi;
  allowLeave: () => void;
}

export const CAMPAIGN_FORM_FIELDS = Object.keys(campaignFormSchema.shape);

/** Campanha nova: o mês que vem inteiro (as campanhas são mensais). */
function nextMonthPeriod(): { startsAt: string; endsAt: string } {
  const [first, last] = monthBounds(addMonths(currentMonth(), 1));
  return {
    startsAt: fromZonedInput(`${first}T00:00`) ?? new Date().toISOString(),
    endsAt: fromZonedInput(`${last}T23:59`) ?? new Date().toISOString(),
  };
}

export function campaignToFormValues(c?: Campaign): CampaignFormInput {
  const period = c ? { startsAt: c.startsAt, endsAt: c.endsAt } : nextMonthPeriod();
  return {
    name: c?.name ?? "",
    description: c?.description ?? null,
    ...period,
    status: c?.status ?? "draft",
  };
}

const DESCRIPTION_MAX = 400;

export function CampaignForm({
  campaign,
  onSubmit,
  saving,
  readOnly = false,
  submitLabel,
}: {
  campaign?: Campaign;
  onSubmit: (values: CampaignFormValues, ctx: CampaignFormContext) => void;
  saving: boolean;
  readOnly?: boolean;
  submitLabel: string;
}) {
  const creating = !campaign;
  const form: CampaignFormApi = useForm<CampaignFormInput, unknown, CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    values: useMemo(() => campaignToFormValues(campaign), [campaign]),
    resetOptions: { keepDirtyValues: true },
  });
  const { register, control, formState } = form;
  const { errors, isDirty } = formState;
  const { allowLeave } = useUnsavedChangesGuard(isDirty && !saving);
  const description = useWatch({ control, name: "description" });

  return (
    <form onSubmit={form.handleSubmit((v) => onSubmit(v, { form, allowLeave }))} noValidate>
      <fieldset disabled={readOnly} className="min-w-0">
        <Card padding="lg">
          <FormSection
            title="Campanha"
            description="O nome aparece no topo da tela de Selos do app."
          >
            <Field
              label="Nome"
              required
              hint="Ex.: Desafios de novembro"
              error={errors.name?.message}
            >
              <Input autoFocus={creating} {...register("name")} />
            </Field>
            <Field
              label="Descrição"
              optional
              action={`${formatNumber((description ?? "").length)}/${DESCRIPTION_MAX}`}
              error={errors.description?.message}
            >
              <Textarea
                rows={3}
                maxLength={DESCRIPTION_MAX}
                {...register("description", { setValueAs: emptyToNull })}
              />
            </Field>
          </FormSection>
          <FormSection
            title="Período"
            description="Horário de Brasília. Os QR Codes só dão selo enquanto a campanha está no ar."
          >
            <FieldRow>
              <Field label="Começa em" required error={errors.startsAt?.message}>
                <Controller
                  control={control}
                  name="startsAt"
                  render={({ field }) => (
                    <DateTimeInput
                      value={field.value}
                      onChange={(v) => field.onChange(v ?? "")}
                      onBlur={field.onBlur}
                      disabled={readOnly}
                    />
                  )}
                />
              </Field>
              <Field label="Termina em" required error={errors.endsAt?.message}>
                <Controller
                  control={control}
                  name="endsAt"
                  render={({ field }) => (
                    <DateTimeInput
                      value={field.value}
                      onChange={(v) => field.onChange(v ?? "")}
                      onBlur={field.onBlur}
                      disabled={readOnly}
                    />
                  )}
                />
              </Field>
            </FieldRow>
          </FormSection>
        </Card>
      </fieldset>
      {!readOnly && (
        <SaveBar
          dirty={isDirty}
          saving={saving}
          // Sempre à vista; na edição fica desabilitado até mudar algum campo.
          alwaysVisible
          disabled={!creating && !isDirty}
          onReset={creating ? undefined : () => form.reset()}
          submitLabel={submitLabel}
        />
      )}
    </form>
  );
}
