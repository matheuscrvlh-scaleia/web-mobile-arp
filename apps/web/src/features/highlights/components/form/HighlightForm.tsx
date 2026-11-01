import { type Highlight, highlightStatusSchema } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Megaphone, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { Controller, type UseFormReturn, useForm, useWatch } from "react-hook-form";
import { useStoreOptions } from "@/features/stores";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import { formatNumber } from "@/shared/lib/format";
import { emptyToNull } from "@/shared/lib/text";
import {
  Card,
  DateTimeInput,
  Field,
  FieldRow,
  FormSection,
  ImageUpload,
  Input,
  SaveBar,
  Segmented,
  Select,
  Textarea,
} from "@/shared/ui";
import {
  type HighlightFormInput,
  type HighlightFormValues,
  highlightFormSchema,
  highlightToFormValues,
} from "../../lib/form";
import { BADGE_LABEL, DEFAULT_CTA, HIGHLIGHT_STATUS_LABEL } from "../HighlightBadges";
import { HighlightPhonePreview } from "../HighlightPhonePreview";
import type { SlideContent } from "../HighlightSlide";
import { TargetFields } from "./TargetFields";

export type HighlightForm = UseFormReturn<HighlightFormInput, unknown, HighlightFormValues>;
export interface HighlightFormContext {
  form: HighlightForm;
  allowLeave: () => void;
}

const nullable = { setValueAs: emptyToNull };
const SUBTITLE_MAX = 160;

/** Formulário do destaque (criar e editar) com a prévia no celular ao lado. */
export function HighlightForm({
  highlight,
  next,
  total,
  onSubmit,
  saving,
  readOnly = false,
  submitLabel,
}: {
  highlight?: Highlight;
  /** Próximo slide do carrossel (para a prévia). */
  next?: SlideContent;
  total: number;
  onSubmit: (values: HighlightFormValues, ctx: HighlightFormContext) => void;
  saving: boolean;
  readOnly?: boolean;
  submitLabel: string;
}) {
  const creating = !highlight;
  const form: HighlightForm = useForm<HighlightFormInput, unknown, HighlightFormValues>({
    resolver: zodResolver(highlightFormSchema),
    values: useMemo(() => highlightToFormValues(highlight), [highlight]),
    resetOptions: { keepDirtyValues: true },
  });
  const { register, control, formState } = form;
  const { errors, isDirty } = formState;
  const { allowLeave } = useUnsavedChangesGuard(isDirty && !saving);
  const stores = useStoreOptions();
  const w = useWatch({ control });
  const badge = w.badge ?? "featured";

  return (
    <form onSubmit={form.handleSubmit((v) => onSubmit(v, { form, allowLeave }))} noValidate>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_19.5rem]">
        <fieldset disabled={readOnly} className="min-w-0">
          <Card padding="lg">
            <FormSection title="Conteúdo" description="Curto: o slide tem pouco espaço.">
              <Field label="Título" required error={errors.title?.message}>
                <Input autoFocus={creating} maxLength={80} {...register("title")} />
              </Field>
              <Field
                label="Subtítulo"
                optional
                action={`${formatNumber((w.subtitle ?? "").length)}/${SUBTITLE_MAX}`}
                error={errors.subtitle?.message}
              >
                <Textarea rows={2} maxLength={SUBTITLE_MAX} {...register("subtitle", nullable)} />
              </Field>
              <Field
                label="Texto do botão"
                optional
                hint="Sem texto, o slide fica sem botão."
                error={errors.ctaLabel?.message}
              >
                <Input
                  maxLength={30}
                  placeholder={DEFAULT_CTA[w.targetType ?? "none"] ?? "Ex.: Ver programação"}
                  {...register("ctaLabel", nullable)}
                />
              </Field>
              <Field
                label="Imagem"
                optional
                hint="Sem imagem, o slide fica verde (estilo promoção)."
                error={errors.imageUrl?.message}
              >
                <Controller
                  control={control}
                  name="imageUrl"
                  render={({ field }) => (
                    <ImageUpload
                      label="imagem do destaque"
                      value={field.value}
                      onChange={field.onChange}
                      disabled={readOnly}
                    />
                  )}
                />
              </Field>
            </FormSection>

            <FormSection
              title="Tipo"
              description="Patrocinado é mídia paga, vendida pelo comercial."
            >
              <Controller
                control={control}
                name="badge"
                render={({ field }) => (
                  <Segmented
                    label="Tipo"
                    value={field.value ?? "featured"}
                    onChange={field.onChange}
                    options={[
                      { value: "featured", label: "Destaque da ARP", icon: Sparkles },
                      { value: "sponsored", label: BADGE_LABEL.sponsored, icon: Megaphone },
                    ]}
                    className={readOnly ? "pointer-events-none w-fit opacity-70" : "w-fit"}
                  />
                )}
              />
              {badge === "sponsored" && (
                <Field label="Patrocinador" optional error={errors.sponsorStoreId?.message}>
                  <Select placeholder="Sem loja" {...register("sponsorStoreId", nullable)}>
                    {(stores.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </FormSection>

            <FormSection title="Destino" description="O que abre quando o visitante toca no slide.">
              <TargetFields form={form} readOnly={readOnly} currentLabel={highlight?.targetLabel} />
            </FormSection>

            <FormSection
              title="Período e publicação"
              description="Horário de Brasília. Fora do período, o slide sai do carrossel sozinho."
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
                        min={w.startsAt}
                        disabled={readOnly}
                      />
                    )}
                  />
                </Field>
              </FieldRow>
              <Field label="Situação" error={errors.status?.message}>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Segmented
                      label="Situação"
                      value={field.value ?? "draft"}
                      onChange={field.onChange}
                      options={highlightStatusSchema.options.map((s) => ({
                        value: s,
                        label: HIGHLIGHT_STATUS_LABEL[s],
                      }))}
                      className={readOnly ? "pointer-events-none w-fit opacity-70" : "w-fit"}
                    />
                  )}
                />
              </Field>
            </FormSection>
          </Card>
        </fieldset>

        <aside aria-label="Prévia na home do app" className="hidden xl:block">
          <div className="sticky top-6 flex flex-col gap-2">
            <p className="text-xs font-medium text-neutral-500">Na home do app</p>
            <HighlightPhonePreview
              slide={{
                title: w.title ?? "",
                subtitle: w.subtitle,
                ctaLabel: w.ctaLabel,
                imageUrl: w.imageUrl,
                badge,
              }}
              next={next}
              total={total}
            />
          </div>
        </aside>
      </div>
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
