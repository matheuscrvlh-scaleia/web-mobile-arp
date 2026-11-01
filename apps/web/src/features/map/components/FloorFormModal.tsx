import { createFloorBodySchema, type Floor } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { pickDirty } from "@/shared/lib/forms";
import { Button, Field, FieldRow, Input, Modal, toast } from "@/shared/ui";
import { useSaveFloor } from "../api";

// O desenho do andar é editado no próprio mapa; aqui só nível e nomes.
const floorFormSchema = createFloorBodySchema.omit({ layout: true });
type FloorFormValues = z.output<typeof floorFormSchema>;
const FIELDS = ["level", "label", "shortLabel"];

export function FloorFormModal({
  open,
  floor,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Sem andar: criar. */
  floor?: Floor;
  onClose: () => void;
  onSaved?: (id?: string) => void;
}) {
  const save = useSaveFloor();
  const form = useForm<z.input<typeof floorFormSchema>, unknown, FloorFormValues>({
    resolver: zodResolver(floorFormSchema),
    values: floor
      ? { level: floor.level, label: floor.label, shortLabel: floor.shortLabel }
      : { level: 0, label: "", shortLabel: "" },
  });
  const { errors } = form.formState;

  const close = () => {
    form.reset();
    save.reset();
    onClose();
  };

  const onSubmit = form.handleSubmit((values) => {
    // Editar manda só o que mudou (o desenho fica de fora); criar começa sem desenho.
    const input = floor
      ? { id: floor.id, body: pickDirty(values, form.formState.dirtyFields) }
      : { body: { ...values, layout: [] } };
    save.mutate(input, {
      onSuccess: (saved) => {
        toast.success(floor ? "Andar salvo." : "Andar criado. Agora desenhe o mapa dele.");
        onSaved?.(saved.id);
        close();
      },
      onError: (e) => {
        if (!applyApiErrors(e, form.setError, FIELDS)) toast.error(errorMessage(e));
      },
    });
  });

  return (
    <Modal
      open={open}
      onClose={close}
      busy={save.isPending}
      title={floor ? `Editar ${floor.label}` : "Novo andar"}
      description="O nível define a ordem no elevador do app (0 = térreo; negativo = subsolo)."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-andar" loading={save.isPending}>
            {floor ? "Salvar" : "Criar andar"}
          </Button>
        </>
      }
    >
      <form id="form-andar" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Nome" required hint="Ex.: Térreo, 1º andar" error={errors.label?.message}>
          <Input autoFocus {...form.register("label")} />
        </Field>
        <FieldRow>
          <Field
            label="Sigla do botão"
            required
            hint="Até 3 letras (T, 1, S1)"
            error={errors.shortLabel?.message}
          >
            <Input maxLength={3} className="uppercase" {...form.register("shortLabel")} />
          </Field>
          <Field label="Nível" required error={errors.level?.message}>
            <Input type="number" step={1} {...form.register("level", { valueAsNumber: true })} />
          </Field>
        </FieldRow>
      </form>
    </Modal>
  );
}
