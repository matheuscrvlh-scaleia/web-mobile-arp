import { createEventCategoryBodySchema, type EventCategory } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { saveInput } from "@/shared/lib/forms";
import { Button, Field, FieldRow, IconPicker, Input, Modal, toast } from "@/shared/ui";
import { useSaveEventCategory } from "../api";

type FormInput = z.input<typeof createEventCategoryBodySchema>;
type Values = z.output<typeof createEventCategoryBodySchema>;
const FIELDS = ["name", "icon", "sortOrder"];

/** Criar ou editar categoria de evento (Música, Cultura, Gastronomia…). */
export function EventCategoryFormModal({
  open,
  category,
  onClose,
}: {
  open: boolean;
  category?: EventCategory;
  onClose: () => void;
}) {
  const save = useSaveEventCategory();
  const form = useForm<FormInput, unknown, Values>({
    resolver: zodResolver(createEventCategoryBodySchema),
    values: category
      ? { name: category.name, icon: category.icon, sortOrder: category.sortOrder }
      : { name: "", icon: "calendar-days", sortOrder: 0 },
  });
  const { errors } = form.formState;
  const close = () => {
    form.reset();
    save.reset();
    onClose();
  };

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(saveInput(category?.id, values, form.formState.dirtyFields), {
      onSuccess: () => {
        toast.success(category ? "Categoria salva." : "Categoria criada.");
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
      title={category ? `Editar ${category.name}` : "Nova categoria de evento"}
      description="Agrupa a agenda do app e define o ícone padrão dos eventos sem foto."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-categoria-evento" loading={save.isPending}>
            {category ? "Salvar" : "Criar categoria"}
          </Button>
        </>
      }
    >
      <form
        id="form-categoria-evento"
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-4"
      >
        <Field
          label="Nome"
          required
          hint="Ex.: Música, Cultura, Oficina"
          error={errors.name?.message}
        >
          <Input autoFocus {...form.register("name")} />
        </Field>
        <FieldRow>
          <Field label="Ícone" required error={errors.icon?.message}>
            <Controller
              control={form.control}
              name="icon"
              render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} />}
            />
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
      </form>
    </Modal>
  );
}
