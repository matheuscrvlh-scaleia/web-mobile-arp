import {
  createStoreCategoryBodySchema,
  STORE_KIND_LABEL,
  type StoreCategory,
  storeKindSchema,
} from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { saveInput } from "@/shared/lib/forms";
import { Button, Field, FieldRow, IconPicker, Input, Modal, Segmented, toast } from "@/shared/ui";
import { useSaveStoreCategory } from "../api";

type Values = z.output<typeof createStoreCategoryBodySchema>;
const FIELDS = ["name", "kind", "icon", "sortOrder"];

export function CategoryFormModal({
  open,
  category,
  defaultKind = "shop",
  onClose,
}: {
  open: boolean;
  category?: StoreCategory;
  defaultKind?: StoreCategory["kind"];
  onClose: () => void;
}) {
  const save = useSaveStoreCategory();
  const form = useForm<z.input<typeof createStoreCategoryBodySchema>, unknown, Values>({
    resolver: zodResolver(createStoreCategoryBodySchema),
    values: category
      ? {
          name: category.name,
          kind: category.kind,
          icon: category.icon,
          sortOrder: category.sortOrder,
        }
      : { name: "", kind: defaultKind, icon: "store", sortOrder: 0 },
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
      title={category ? `Editar ${category.name}` : "Nova categoria"}
      description="Agrupa as lojas no guia e nos filtros do app."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-categoria" loading={save.isPending}>
            {category ? "Salvar" : "Criar categoria"}
          </Button>
        </>
      }
    >
      <form id="form-categoria" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field
          label="Nome"
          required
          hint="Ex.: Restaurantes, Moda, Pet"
          error={errors.name?.message}
        >
          <Input autoFocus {...form.register("name")} />
        </Field>
        <Field label="Tipo" required error={errors.kind?.message}>
          <Controller
            control={form.control}
            name="kind"
            render={({ field }) => (
              <Segmented
                label="Tipo"
                value={field.value}
                onChange={field.onChange}
                options={storeKindSchema.options.map((k) => ({
                  value: k,
                  label: STORE_KIND_LABEL[k],
                }))}
              />
            )}
          />
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
