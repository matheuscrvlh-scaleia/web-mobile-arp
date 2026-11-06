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
import { Button, Field, IconPicker, Input, Modal, Segmented, toast } from "@/shared/ui";
import { useSaveStoreCategory } from "../api";
import { confirmDiscard } from "./confirm-discard";

type Values = z.output<typeof createStoreCategoryBodySchema>;
const FIELDS = ["name", "kind", "icon"];

export function CategoryFormModal({
  open,
  category,
  defaultKind = "shop",
  nextOrder = 0,
  onClose,
}: {
  open: boolean;
  category?: StoreCategory;
  defaultKind?: StoreCategory["kind"];
  /** Nova categoria entra no fim da lista do tipo (a ordem muda arrastando). */
  nextOrder?: number;
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
      : { name: "", kind: defaultKind, icon: "store", sortOrder: nextOrder },
  });
  const { errors } = form.formState;
  const close = () => {
    form.reset();
    save.reset();
    onClose();
  };
  // Fechar com algo digitado pergunta antes de descartar.
  const tryClose = async () => {
    if (form.formState.isDirty && !(await confirmDiscard())) return;
    close();
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
      onClose={() => void tryClose()}
      busy={save.isPending}
      title={category ? `Editar ${category.name}` : "Nova categoria"}
      description="Agrupa as lojas no guia e nos filtros do app."
      footer={
        <>
          <Button variant="secondary" onClick={() => void tryClose()} disabled={save.isPending}>
            Voltar
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
        <Field label="Ícone" required error={errors.icon?.message}>
          <Controller
            control={form.control}
            name="icon"
            render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} />}
          />
        </Field>
      </form>
    </Modal>
  );
}
