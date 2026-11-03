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
const FIELDS = ["name", "description", "kind", "points", "stock", "imageUrl", "sortOrder"];

function toValues(p?: Prize): PrizeInput {
  return {
    name: p?.name ?? "",
    description: p?.description ?? "",
    kind: p?.kind ?? "souvenir",
    points: p?.points ?? 50,
    stock: p?.stock ?? 10,
    imageUrl: p?.imageUrl ?? null,
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
  const { errors } = form.formState;
  const close = () => {
    form.reset();
    save.reset();
    onClose();
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
      onClose={close}
      busy={save.isPending}
      title={prize ? `Editar ${prize.name}` : "Novo prêmio"}
      description="O visitante troca os pontos do Clube ARP e retira no Centro de Informações."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
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
        <Field label="Descrição" optional error={errors.description?.message}>
          <Textarea rows={2} maxLength={300} {...form.register("description")} />
        </Field>
        <FieldRow>
          <Field label="Tipo" required error={errors.kind?.message}>
            <Select {...form.register("kind")}>
              {prizeKindSchema.options.map((k) => (
                <option key={k} value={k}>
                  {PRIZE_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ordem" hint="Menor aparece primeiro" error={errors.sortOrder?.message}>
            <Input
              type="number"
              min={0}
              max={999}
              {...form.register("sortOrder", { valueAsNumber: true })}
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Pontos" required error={errors.points?.message}>
            <Input type="number" min={1} {...form.register("points", { valueAsNumber: true })} />
          </Field>
          <Field label="Estoque" required hint="0 = sai da lojinha" error={errors.stock?.message}>
            <Input type="number" min={0} {...form.register("stock", { valueAsNumber: true })} />
          </Field>
        </FieldRow>
        <Field label="Foto" optional error={errors.imageUrl?.message}>
          <Controller
            control={form.control}
            name="imageUrl"
            render={({ field }) => (
              <ImageUpload
                label="foto do prêmio"
                value={field.value ?? null}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
        <Controller
          control={form.control}
          name="active"
          render={({ field }) => (
            <Switch
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
              label="Aparece na lojinha"
            />
          )}
        />
      </form>
    </Modal>
  );
}
