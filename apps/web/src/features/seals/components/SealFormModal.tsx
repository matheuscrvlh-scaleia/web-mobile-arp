import { createSealBodySchema, type Seal } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { cn } from "@/shared/lib/cn";
import { saveInput } from "@/shared/lib/forms";
import { emptyToNull } from "@/shared/lib/text";
import {
  Button,
  ColorInput,
  confirmar,
  DateTimeInput,
  Field,
  FieldRow,
  IconPicker,
  Input,
  Modal,
  Switch,
  Textarea,
  toast,
} from "@/shared/ui";
import { useSaveSeal } from "../api";
import { MoreOptions } from "./MoreOptions";
import { SealBadge } from "./SealBadge";

type SealInput = z.input<typeof createSealBodySchema>;
type SealValues = z.output<typeof createSealBodySchema>;
const FIELDS = Object.keys(createSealBodySchema.shape);
const sealFormSchema = createSealBodySchema.refine(
  (v) =>
    !v.availableFrom || !v.availableUntil || new Date(v.availableUntil) > new Date(v.availableFrom),
  { message: "O fim precisa ser depois do início", path: ["availableUntil"] },
);

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
    points: seal?.points ?? 10,
    validityMonths: seal?.validityMonths ?? 6,
    repeatable: seal?.repeatable ?? false,
    availableFrom: seal?.availableFrom ?? null,
    availableUntil: seal?.availableUntil ?? null,
  };
}

/**
 * Criar ou editar selo, com a prévia ao vivo como o app desenha. À vista só
 * o essencial (nome, ícone, cor, descrição); pontos, validade, repetível,
 * cores exatas e período ficam em "Mais opções". O identificador interno
 * (slug) sai sozinho do nome e a posição nova é o fim da coleção.
 */
export function SealFormModal({
  seal,
  nextOrder,
  readOnly,
  onClose,
  onSaved,
}: {
  seal?: Seal;
  /** Ordem sugerida para um selo novo (vai para o fim da coleção). */
  nextOrder: number;
  readOnly: boolean;
  onClose: () => void;
  /** Selo salvo (ex.: o formulário do desafio já escolhe o selo criado). */
  onSaved?: (seal: Seal) => void;
}) {
  const save = useSaveSeal();
  const form = useForm<SealInput, unknown, SealValues>({
    resolver: zodResolver(sealFormSchema),
    defaultValues: sealToFormValues(seal, nextOrder),
  });
  const { register, control, formState, setValue } = form;
  const { errors, isDirty } = formState;
  // Fechar com algo digitado pergunta antes (não perde o que a pessoa escreveu).
  const requestClose = async () => {
    if (
      !isDirty ||
      readOnly ||
      (await confirmar({
        title: seal ? "Descartar as alterações do selo?" : "Descartar o selo novo?",
        description: "O que você preencheu aqui não foi salvo.",
        confirmLabel: "Descartar",
        cancelLabel: "Continuar editando",
        danger: true,
      }))
    )
      onClose();
  };
  const advancedErrors = Boolean(
    errors.points ||
      errors.validityMonths ||
      errors.availableFrom ||
      errors.availableUntil ||
      errors.gradientFrom ||
      errors.gradientTo,
  );
  const [name, icon, from, to, availableFrom, points, repeatable] = useWatch({
    control,
    name: ["name", "icon", "gradientFrom", "gradientTo", "availableFrom", "points", "repeatable"],
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
      onSuccess: (saved) => {
        toast.success(seal ? "Selo salvo." : `Selo ${saved.name} criado.`);
        onClose();
        onSaved?.(saved);
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
      onClose={() => void requestClose()}
      busy={save.isPending}
      size="lg"
      title={seal ? (readOnly ? seal.name : `Editar ${seal.name}`) : "Nova categoria de selo"}
      description="O selo que o visitante ganha ao cumprir um desafio."
      footer={
        readOnly ? (
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={() => void requestClose()}
              disabled={save.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" form="form-selo" loading={save.isPending}>
              {seal ? "Salvar" : "Criar categoria"}
            </Button>
          </>
        )
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_14rem]">
        <form id="form-selo" onSubmit={onSubmit} noValidate>
          <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4">
            <Field label="Nome" required hint="Ex.: Explorador" error={errors.name?.message}>
              <Input autoFocus={!readOnly} maxLength={40} {...register("name")} />
            </Field>
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
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-xs font-medium text-neutral-600">Cor do selo</legend>
              <div className="flex flex-wrap gap-2">
                {SEAL_GRADIENTS.map((g, i) => {
                  const on = g[0] === from && g[1] === to;
                  return (
                    <button
                      key={g.join()}
                      type="button"
                      onClick={() => pickGradient(g)}
                      aria-label={`Cor ${i + 1}`}
                      aria-pressed={on}
                      className={cn(
                        "grid size-10 cursor-pointer place-items-center rounded-full text-[#fff] transition hover:scale-110 disabled:cursor-not-allowed",
                        on && "ring-2 ring-neutral-900 ring-offset-2",
                      )}
                      style={{ background: `linear-gradient(145deg, ${g[0]}, ${g[1]})` }}
                    >
                      {on && <Check className="size-4" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Field label="Descrição" optional error={errors.description?.message}>
              <Textarea
                rows={2}
                maxLength={240}
                {...register("description", { setValueAs: emptyToNull })}
              />
            </Field>
            <MoreOptions
              summary={`${points ?? 10} Trevos padrão · ${repeatable ? "repetível" : "uma vez por pessoa"}`}
              defaultOpen={Boolean(seal?.availableFrom || seal?.availableUntil)}
              forceOpen={advancedErrors}
            >
              <Field
                label="Trevos padrão"
                required
                hint="Usados quando o desafio não define os Trevos do selo. Selos não vencem: viram histórico."
                error={errors.points?.message}
              >
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  {...register("points", { valueAsNumber: true })}
                />
              </Field>
              <Controller
                control={control}
                name="repeatable"
                render={({ field }) => (
                  <Switch
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    label="Repetível"
                    description="Pode ser ganho de novo (um por QR Code). Desligado = uma vez por pessoa."
                  />
                )}
              />
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
              <p className="text-xs text-neutral-500">
                Período do selo: quase sempre fica vazio, porque cada desafio já vale no período da
                campanha. Use só se este selo tiver data própria em qualquer campanha.
              </p>
              <FieldRow>
                <Field
                  label="Pode ser ganho a partir de"
                  optional
                  error={errors.availableFrom?.message}
                >
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
                <Field
                  label="Pode ser ganho até"
                  optional
                  hint="Quem já ganhou mantém."
                  error={errors.availableUntil?.message}
                >
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
