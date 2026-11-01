import { createSealBodySchema, type Seal } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { cn } from "@/shared/lib/cn";
import { saveInput } from "@/shared/lib/forms";
import { emptyToNull, slugify } from "@/shared/lib/text";
import {
  Button,
  ColorInput,
  Field,
  FieldRow,
  IconPicker,
  Input,
  Modal,
  Textarea,
  toast,
} from "@/shared/ui";
import { useSaveSeal } from "../api";
import { SealBadge } from "./SealBadge";

type SealInput = z.input<typeof createSealBodySchema>;
type SealValues = z.output<typeof createSealBodySchema>;
const FIELDS = Object.keys(createSealBodySchema.shape);

/** Degradês dos selos do app (claro → escuro), para começar com algo que combina. */
export const SEAL_GRADIENTS: readonly (readonly [string, string])[] = [
  ["#7fd68d", "#2f7d3d"],
  ["#9be0a5", "#3a9a4b"],
  ["#f2b38a", "#c8692f"],
  ["#c7a3ff", "#7d5a8c"],
  ["#ffd27a", "#c99220"],
  ["#9cc5ff", "#2b4c6f"],
  ["#f5a3b8", "#d0607a"],
  ["#8fd3d6", "#3c6e71"],
];
const FROM_SWATCHES = SEAL_GRADIENTS.map((g) => g[0]);
const TO_SWATCHES = SEAL_GRADIENTS.map((g) => g[1]);
const HEX = /^#[0-9a-fA-F]{6}$/;

export function sealToFormValues(seal: Seal | undefined, nextOrder: number): SealInput {
  return {
    name: seal?.name ?? "",
    slug: seal?.slug,
    description: seal?.description ?? null,
    icon: seal?.icon ?? "award",
    gradientFrom: seal?.gradientFrom ?? "#7fd68d",
    gradientTo: seal?.gradientTo ?? "#2f7d3d",
    sortOrder: seal?.sortOrder ?? nextOrder,
    status: seal?.status ?? "active",
  };
}

/** Criar ou editar selo, com a prévia ao vivo como o app desenha. */
export function SealFormModal({
  seal,
  nextOrder,
  readOnly,
  onClose,
}: {
  seal?: Seal;
  /** Ordem sugerida para um selo novo (vai para o fim da coleção). */
  nextOrder: number;
  readOnly: boolean;
  onClose: () => void;
}) {
  const save = useSaveSeal();
  const form = useForm<SealInput, unknown, SealValues>({
    resolver: zodResolver(createSealBodySchema),
    defaultValues: sealToFormValues(seal, nextOrder),
  });
  const { register, control, formState, setValue } = form;
  const { errors } = formState;
  const [name, icon, from, to] = useWatch({
    control,
    name: ["name", "icon", "gradientFrom", "gradientTo"],
  });
  const preview = {
    icon,
    gradientFrom: HEX.test(from) ? from : "#7fd68d",
    gradientTo: HEX.test(to) ? to : "#2f7d3d",
  };

  const onSubmit = form.handleSubmit((values) => {
    const input = saveInput(seal?.id, values, formState.dirtyFields);
    if (Object.keys(input.body).length === 0) return onClose();
    save.mutate(input, {
      onSuccess: () => {
        toast.success(seal ? "Selo salvo." : "Selo criado.");
        onClose();
      },
      onError: (e) => {
        if (!applyApiErrors(e, form.setError, FIELDS)) toast.error(errorMessage(e));
      },
    });
  });

  const pickGradient = ([a, b]: readonly [string, string]) => {
    setValue("gradientFrom", a, { shouldDirty: true, shouldValidate: true });
    setValue("gradientTo", b, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      size="lg"
      title={seal ? (readOnly ? seal.name : `Editar ${seal.name}`) : "Novo selo"}
      description="O selo que o visitante ganha ao cumprir um desafio."
      footer={
        readOnly ? (
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button type="submit" form="form-selo" loading={save.isPending}>
              {seal ? "Salvar" : "Criar selo"}
            </Button>
          </>
        )
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_14rem]">
        <form id="form-selo" onSubmit={onSubmit} noValidate>
          <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4">
            <FieldRow>
              <Field label="Nome" required hint="Ex.: Explorador" error={errors.name?.message}>
                <Input autoFocus={!readOnly} maxLength={40} {...register("name")} />
              </Field>
              <Field
                label="Identificador (slug)"
                optional
                hint={name ? `Sem preencher: ${slugify(name)}` : "Letras minúsculas e hífens."}
                error={errors.slug?.message}
              >
                <Input
                  className="font-mono"
                  placeholder={slugify(name ?? "") || "explorador"}
                  {...register("slug", { setValueAs: (v: unknown) => (v === "" ? undefined : v) })}
                />
              </Field>
            </FieldRow>
            <Field label="Descrição" optional error={errors.description?.message}>
              <Textarea
                rows={2}
                maxLength={240}
                {...register("description", { setValueAs: emptyToNull })}
              />
            </Field>
            <FieldRow>
              <Field label="Ícone" required error={errors.icon?.message}>
                <Controller
                  control={control}
                  name="icon"
                  render={({ field }) => (
                    <IconPicker
                      value={field.value}
                      onChange={field.onChange}
                      color={preview.gradientTo}
                      disabled={readOnly}
                    />
                  )}
                />
              </Field>
              <Field label="Ordem" hint="Menor aparece primeiro" error={errors.sortOrder?.message}>
                <Input
                  type="number"
                  min={0}
                  max={999}
                  {...register("sortOrder", { valueAsNumber: true })}
                />
              </Field>
            </FieldRow>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-xs font-medium text-neutral-600">
                Degradês prontos
              </legend>
              <div className="flex flex-wrap gap-2">
                {SEAL_GRADIENTS.map((g) => {
                  const on = g[0] === from && g[1] === to;
                  return (
                    <button
                      key={g.join()}
                      type="button"
                      onClick={() => pickGradient(g)}
                      aria-label={`Degradê ${g[0]} para ${g[1]}`}
                      aria-pressed={on}
                      className={cn(
                        "grid size-8 cursor-pointer place-items-center rounded-full text-[#fff] transition hover:scale-110 disabled:cursor-not-allowed",
                        on && "ring-2 ring-neutral-900 ring-offset-2",
                      )}
                      style={{ background: `linear-gradient(145deg, ${g[0]}, ${g[1]})` }}
                    >
                      {on && <Check className="size-3.5" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <FieldRow>
              <Field label="Cor clara (início)" required error={errors.gradientFrom?.message}>
                <Controller
                  control={control}
                  name="gradientFrom"
                  render={({ field }) => (
                    <ColorInput
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      swatches={FROM_SWATCHES}
                      disabled={readOnly}
                    />
                  )}
                />
              </Field>
              <Field label="Cor escura (fim)" required error={errors.gradientTo?.message}>
                <Controller
                  control={control}
                  name="gradientTo"
                  render={({ field }) => (
                    <ColorInput
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      swatches={TO_SWATCHES}
                      disabled={readOnly}
                    />
                  )}
                />
              </Field>
            </FieldRow>
          </fieldset>
        </form>
        <SealPreview name={name} seal={preview} />
      </div>
    </Modal>
  );
}

/** Prévia: o selo conquistado e como fica bloqueado na coleção do app. */
function SealPreview({
  name,
  seal,
}: {
  name: string;
  seal: { icon: string; gradientFrom: string; gradientTo: string };
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-neutral-500">Prévia no app</p>
      <div
        aria-hidden
        className="flex flex-col items-center gap-5 rounded-[1.75rem] bg-[#f6f5f3] px-4 py-6 text-[#141714]"
      >
        <SealBadge seal={seal} size="xl" />
        <p className="text-center text-sm font-semibold">{name || "Nome do selo"}</p>
        <div className="flex gap-4 text-center text-[11px] text-[#77716a]">
          <span className="flex flex-col items-center gap-1.5">
            <SealBadge seal={seal} size={52} />
            Conquistado
          </span>
          <span className="flex flex-col items-center gap-1.5">
            <SealBadge seal={seal} size={52} locked />
            Bloqueado
          </span>
        </div>
      </div>
    </div>
  );
}
