import {
  createPrizeBodySchema,
  PRIZE_KIND_LABEL,
  type Prize,
  prizeKindSchema,
} from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { saveInput } from "@/shared/lib/forms";
import {
  Button,
  confirmar,
  Field,
  FieldRow,
  ImageUpload,
  Input,
  Modal,
  Select,
  Switch,
  Textarea,
  toast,
} from "@/shared/ui";
import { useSavePrize } from "../api";

type PrizeInput = z.input<typeof createPrizeBodySchema>;
type PrizeValues = z.output<typeof createPrizeBodySchema>;
const FIELDS = [
  "name",
  "description",
  "pickupRules",
  "kind",
  "points",
  "stock",
  "imageUrl",
  "sortOrder",
];

function toValues(p?: Prize): PrizeInput {
  return {
    name: p?.name ?? "",
    description: p?.description ?? "",
    kind: p?.kind ?? "souvenir",
    points: p?.points ?? 50,
    stock: p?.stock ?? 10,
    imageUrl: p?.imageUrl ?? null,
    pickupRules: p?.pickupRules ?? "",
    active: p?.active ?? true,
    sortOrder: p?.sortOrder ?? 0,
  };
}

/** Prêmio da lojinha: pontos e estoque (estoque 0 sai da lojinha do app). */
export function PrizeFormModal({
  open,
  prize,
  onClose,
}: {
  open: boolean;
  prize?: Prize;
  onClose: () => void;
}) {
  const save = useSavePrize();
  const form = useForm<PrizeInput, unknown, PrizeValues>({
    resolver: zodResolver(createPrizeBodySchema),
    values: toValues(prize),
  });
  const { errors, isDirty } = form.formState;
  const close = () => {
    form.reset();
    save.reset();
    onClose();
  };
  // Fechar com algo digitado pergunta antes de descartar.
  const askClose = async () => {
    if (
      !isDirty ||
      (await confirmar({
        title: "Descartar o que foi digitado?",
        description: "As alterações neste prêmio ainda não foram salvas.",
        confirmLabel: "Descartar",
        cancelLabel: "Continuar editando",
        danger: true,
      }))
    )
      close();
  };
  const onSubmit = form.handleSubmit((values) =>
    save.mutate(saveInput(prize?.id, values, form.formState.dirtyFields), {
      onSuccess: () => {
        toast.success(prize ? "Prêmio salvo." : "Prêmio criado.");
        close();
      },
      onError: (e) => {
        if (!applyApiErrors(e, form.setError, FIELDS)) toast.error(errorMessage(e));
      },
    }),
  );

  return (
    <Modal
      open={open}
      onClose={() => void askClose()}
      busy={save.isPending}
      title={prize ? `Editar ${prize.name}` : "Novo prêmio"}
      description="O visitante troca os Trevos no app e retira no Mercado Local com o código."
      footer={
        <>
          <Button variant="secondary" onClick={() => void askClose()} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-premio" loading={save.isPending}>
            {prize ? "Salvar" : "Criar prêmio"}
          </Button>
        </>
      }
    >
      <form id="form-premio" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Nome" required error={errors.name?.message}>
          <Input autoFocus maxLength={80} placeholder="Ecobag ARP" {...form.register("name")} />
        </Field>
        <Controller
          control={form.control}
          name="active"
          render={({ field }) => (
            <Switch
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
              label="Aparece na lojinha do app"
            />
          )}
        />
        <Field label="Descrição" optional error={errors.description?.message}>
          <Textarea rows={2} maxLength={300} {...form.register("description")} />
        </Field>
        <Field
          label="Como retirar"
          optional
          hint="Aparece no app, no detalhe do prêmio. Vazio: “Mostre o código no Mercado Local em até 7 dias”."
          error={errors.pickupRules?.message}
        >
          <Textarea rows={2} maxLength={600} {...form.register("pickupRules")} />
        </Field>
        <Field label="Tipo" required error={errors.kind?.message}>
          <Select {...form.register("kind")}>
            {prizeKindSchema.options.map((k) => (
              <option key={k} value={k}>
                {PRIZE_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <FieldRow>
          <Field label="Pontos" required error={errors.points?.message}>
            <Input type="number" min={1} {...form.register("points", { valueAsNumber: true })} />
          </Field>
          <Field label="Estoque" required hint="0 = sai da lojinha" error={errors.stock?.message}>
            <Input type="number" min={0} {...form.register("stock", { valueAsNumber: true })} />
          </Field>
        </FieldRow>
        <Field label="Foto" optional error={errors.imageUrl?.message} className="sm:max-w-56">
          <Controller
            control={form.control}
            name="imageUrl"
            render={({ field }) => (
              <ImageUpload
                label="foto do prêmio"
                aspect="square"
                value={field.value ?? null}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
        <details className="group rounded-2xl border border-neutral-200 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-neutral-700">Mais opções</summary>
          <Field
            label="Posição na lojinha"
            hint="Menor aparece primeiro; empate vai pelos pontos."
            error={errors.sortOrder?.message}
            className="mt-3 sm:max-w-48"
          >
            <Input
              type="number"
              min={0}
              max={999}
              {...form.register("sortOrder", { valueAsNumber: true })}
            />
          </Field>
        </details>
      </form>
    </Modal>
  );
}
