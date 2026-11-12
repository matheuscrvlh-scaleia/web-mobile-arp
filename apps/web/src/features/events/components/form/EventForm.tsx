import type { Event } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Radio, Save } from "lucide-react";
import { type FormEvent, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useFloors } from "@/features/map";
import { StoreSelect } from "@/features/stores";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import { formatNumber } from "@/shared/lib/format";
import {
  Card,
  Field,
  FieldRow,
  FormSection,
  Input,
  SaveBar,
  Select,
  Switch,
  Textarea,
} from "@/shared/ui";
import { useEventCategories } from "../../api";
import {
  type EventFormInput,
  type EventFormValues,
  eventFormSchema,
  eventToFormValues,
} from "../../lib/form";
import { EventPreview } from "./EventPreview";
import { EventVisualFields } from "./EventVisualFields";
import { PreviewButton } from "./PreviewButton";
import { RecurrenceFields } from "./RecurrenceFields";
import type { EventFormContext, EventFormHandle } from "./types";

const DESCRIPTION_MAX = 1200;

/**
 * Formulário do evento (criar e editar), com a prévia ao lado. Valida com o
 * schema do contrato; quem usa decide o que enviar. `copyOf` = "Duplicar":
 * abre preenchido com o evento de origem.
 */
export function EventForm({
  event,
  copyOf,
  initialStartsOn,
  onSubmit,
  saving,
  readOnly = false,
  submitLabel,
}: {
  event?: Event;
  copyOf?: Event;
  /** Dia já escolhido (clique no calendário). */
  initialStartsOn?: string;
  onSubmit: (values: EventFormValues, ctx: EventFormContext) => void;
  saving: boolean;
  readOnly?: boolean;
  submitLabel: string;
}) {
  const creating = !event;
  const form: EventFormHandle = useForm<EventFormInput, unknown, EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    values: useMemo(() => {
      if (event) return eventToFormValues(event);
      if (copyOf) return eventToFormValues(copyOf, { copy: true });
      const blank = eventToFormValues();
      return initialStartsOn ? { ...blank, startsOn: initialStartsOn } : blank;
    }, [event, copyOf, initialStartsOn]),
    resetOptions: { keepDirtyValues: true },
  });
  const { register, control, formState } = form;
  const { errors, isDirty } = formState;
  const { allowLeave } = useUnsavedChangesGuard(isDirty && !saving);

  const categories = useEventCategories();
  const floors = useFloors();
  const watched = useWatch({ control });
  const category = categories.data?.find((c) => c.id === watched.categoryId);
  const floor = floors.data?.find((f) => f.id === watched.floorId);
  const where = [watched.place, floor?.label].filter(Boolean).join(" · ");

  const preview = (
    <EventPreview
      title={watched.title ?? ""}
      categoryName={category?.name}
      description={watched.description ?? ""}
      imageUrl={watched.imageUrl}
      tone={watched.tone}
      icon={watched.icon ?? category?.icon}
      where={where}
      awardsSeal={Boolean(watched.awardsSeal)}
      when={{
        recurrence: watched.recurrence ?? "single",
        startsOn: watched.startsOn,
        endsOn: watched.endsOn,
        weekdays: watched.weekdays?.filter((d): d is number => d !== undefined),
        startTime: watched.startTime,
        endTime: watched.endTime,
        isLongRunning: watched.isLongRunning,
      }}
    />
  );

  const submitWith = (status?: "draft" | "published") => (e?: FormEvent) => {
    // Criar: "Publicar" (principal) ou "Salvar rascunho" decidem a situação.
    if (status) form.setValue("status", status);
    return form.handleSubmit((v) => onSubmit(v, { form, allowLeave }))(e);
  };

  return (
    <form onSubmit={submitWith(creating ? "published" : undefined)} noValidate>
      <PreviewButton title="Como aparece no app">{preview}</PreviewButton>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <fieldset disabled={readOnly} className="min-w-0">
          <Card padding="lg">
            <FormSection title="Sobre" description="O que aparece no cartão e no detalhe do app.">
              <Field label="Nome" required error={errors.title?.message}>
                <Input autoFocus={creating} {...register("title")} />
              </Field>
              <Field label="Categoria" required error={errors.categoryId?.message}>
                {/* Controlado: com register, o valor chegava antes das opções e o campo
                    aparecia vazio ao abrir pelo link direto (o dado não se perdia). */}
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select
                      placeholder={categories.isLoading ? "Carregando…" : "Escolha a categoria"}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      name={field.name}
                    >
                      {(categories.data ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </Field>
              <Field
                label="Descrição"
                optional
                action={`${formatNumber((watched.description ?? "").length)}/${DESCRIPTION_MAX}`}
                error={errors.description?.message}
              >
                <Textarea rows={4} maxLength={DESCRIPTION_MAX} {...register("description")} />
              </Field>
            </FormSection>

            <FormSection
              title="Quando"
              description="Ninguém cadastra dia a dia: um dia, um período ou toda semana."
            >
              <RecurrenceFields form={form} readOnly={readOnly} />
            </FormSection>

            <FormSection title="Onde" description="O andar leva o visitante ao mapa certo.">
              <Field
                label="Local"
                required
                hint="Ex.: Praça central, Terraço"
                error={errors.place?.message}
              >
                <Input {...register("place")} />
              </Field>
              <Field
                label="Link do ingresso"
                optional
                hint="Quando houver venda ou retirada de ingresso: o app mostra o botão “Ingressos”."
                error={errors.ticketUrl?.message}
              >
                <Input
                  type="url"
                  placeholder="https://"
                  {...register("ticketUrl", { setValueAs: (v: string) => v?.trim() || null })}
                />
              </Field>
              <FieldRow>
                <Field label="Andar" optional error={errors.floorId?.message}>
                  <Controller
                    control={control}
                    name="floorId"
                    render={({ field }) => (
                      <Select
                        placeholder={floors.isLoading ? "Carregando…" : "Sem andar"}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                        onBlur={field.onBlur}
                        name={field.name}
                      >
                        {(floors.data ?? []).map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  />
                </Field>
                <Field label="Loja" optional error={errors.storeId?.message}>
                  <Controller
                    control={control}
                    name="storeId"
                    render={({ field }) => (
                      <StoreSelect
                        value={field.value ?? null}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        placeholder="Sem loja"
                        selectedLabel={(event ?? copyOf)?.store?.name}
                      />
                    )}
                  />
                </Field>
              </FieldRow>
            </FormSection>

            <FormSection title="Visual" description="Foto, ou o tom e o ícone do cartão.">
              <EventVisualFields form={form} readOnly={readOnly} categoryIcon={category?.icon} />
            </FormSection>

            <FormSection title="Selo">
              <Controller
                control={control}
                name="awardsSeal"
                render={({ field }) => (
                  <Switch
                    checked={Boolean(field.value)}
                    onCheckedChange={field.onChange}
                    disabled={readOnly}
                    label="Participar vale selo"
                    description="Mostra “Vale selo”. Ligue o desafio a este evento em Desafios."
                  />
                )}
              />
            </FormSection>
          </Card>
        </fieldset>

        <aside aria-label="Prévia no app" className="hidden xl:block">
          <div className="sticky top-6 flex flex-col gap-2">
            <p className="text-xs font-medium text-neutral-500">Como aparece no app</p>
            {preview}
          </div>
        </aside>
      </div>
      {!readOnly && (
        <SaveBar
          besidePreview
          dirty={isDirty}
          saving={saving}
          alwaysVisible={creating}
          onReset={creating ? undefined : () => form.reset()}
          submitLabel={creating ? "Publicar" : submitLabel}
          submitIcon={creating ? Radio : undefined}
          secondary={
            creating
              ? {
                  label: "Salvar rascunho",
                  icon: Save,
                  onClick: () => void submitWith("draft")(),
                  loading: saving && watched.status === "draft",
                }
              : undefined
          }
        />
      )}
    </form>
  );
}
