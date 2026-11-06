import type { Event } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useFloors } from "@/features/map";
import { useStoreOptions } from "@/features/stores";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import { formatNumber } from "@/shared/lib/format";
import { emptyToNull } from "@/shared/lib/text";
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
import { RecurrenceFields } from "./RecurrenceFields";
import type { EventFormContext, EventFormHandle } from "./types";

const DESCRIPTION_MAX = 1200;
const nullable = { setValueAs: emptyToNull };

/**
 * Formulário do evento (criar e editar), com a prévia ao lado. Valida com o
 * schema do contrato; quem usa decide o que enviar.
 */
export function EventForm({
  event,
  onSubmit,
  saving,
  readOnly = false,
  submitLabel,
}: {
  event?: Event;
  onSubmit: (values: EventFormValues, ctx: EventFormContext) => void;
  saving: boolean;
  readOnly?: boolean;
  submitLabel: string;
}) {
  const creating = !event;
  const form: EventFormHandle = useForm<EventFormInput, unknown, EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    values: useMemo(() => eventToFormValues(event), [event]),
    resetOptions: { keepDirtyValues: true },
  });
  const { register, control, formState } = form;
  const { errors, isDirty } = formState;
  const { allowLeave } = useUnsavedChangesGuard(isDirty && !saving);

  const categories = useEventCategories();
  const floors = useFloors();
  const stores = useStoreOptions();
  const watched = useWatch({ control });
  const category = categories.data?.find((c) => c.id === watched.categoryId);
  const floor = floors.data?.find((f) => f.id === watched.floorId);
  const where = [watched.place, floor?.label].filter(Boolean).join(" · ");

  return (
    <form onSubmit={form.handleSubmit((v) => onSubmit(v, { form, allowLeave }))} noValidate>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <fieldset disabled={readOnly} className="min-w-0">
          <Card padding="lg">
            <FormSection title="Sobre" description="O que aparece no cartão e no detalhe do app.">
              <Field label="Nome" required error={errors.title?.message}>
                <Input autoFocus={creating} {...register("title")} />
              </Field>
              <Field label="Categoria" required error={errors.categoryId?.message}>
                <Select placeholder="Escolha a categoria" {...register("categoryId")}>
                  {(categories.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
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
              <FieldRow>
                <Field label="Andar" optional error={errors.floorId?.message}>
                  <Select placeholder="Sem andar" {...register("floorId", nullable)}>
                    {(floors.data ?? []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Loja" optional error={errors.storeId?.message}>
                  <Select placeholder="Sem loja" {...register("storeId", nullable)}>
                    {(stores.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FieldRow>
            </FormSection>

            <FormSection title="Visual" description="Foto, ou o tom e o ícone do cartão.">
              <EventVisualFields form={form} readOnly={readOnly} categoryIcon={category?.icon} />
            </FormSection>

            <FormSection title="Selo e publicação">
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
              {creating && (
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Switch
                      checked={field.value === "published"}
                      onCheckedChange={(on) => field.onChange(on ? "published" : "draft")}
                      label="Publicar ao criar"
                      description="Desligado, fica como rascunho (fora do app)."
                    />
                  )}
                />
              )}
            </FormSection>
          </Card>
        </fieldset>

        <aside aria-label="Prévia no app" className="hidden xl:block">
          <div className="sticky top-6 flex flex-col gap-2">
            <p className="text-xs font-medium text-neutral-500">Como aparece no app</p>
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
                weekday: watched.weekday,
                startTime: watched.startTime,
                endTime: watched.endTime,
                isLongRunning: watched.isLongRunning,
              }}
            />
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
          submitLabel={submitLabel}
        />
      )}
    </form>
  );
}
