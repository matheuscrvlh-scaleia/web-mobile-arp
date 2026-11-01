import { type Block, createBlockBodySchema } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { saveInput } from "@/shared/lib/forms";
import { Button, Field, FieldRow, Input, Modal, toast } from "@/shared/ui";
import { useSaveBlock } from "../api";

type Values = z.output<typeof createBlockBodySchema>;

export function BlockFormModal({
  open,
  block,
  onClose,
}: {
  open: boolean;
  block?: Block;
  onClose: () => void;
}) {
  const save = useSaveBlock();
  const form = useForm<z.input<typeof createBlockBodySchema>, unknown, Values>({
    resolver: zodResolver(createBlockBodySchema),
    values: block ? { name: block.name, sortOrder: block.sortOrder } : { name: "", sortOrder: 0 },
  });
  const { errors } = form.formState;
  const close = () => {
    form.reset();
    save.reset();
    onClose();
  };
  const onSubmit = form.handleSubmit((values) =>
    save.mutate(saveInput(block?.id, values, form.formState.dirtyFields), {
      onSuccess: () => {
        toast.success(block ? "Bloco salvo." : "Bloco criado.");
        close();
      },
      onError: (e) => {
        if (!applyApiErrors(e, form.setError, ["name", "sortOrder"])) toast.error(errorMessage(e));
      },
    }),
  );

  return (
    <Modal
      open={open}
      onClose={close}
      busy={save.isPending}
      size="sm"
      title={block ? `Editar ${block.name}` : "Novo bloco"}
      description="Os prédios da ARP (ex.: Bloco 80). Aparece em “onde fica” de cada loja."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-bloco" loading={save.isPending}>
            {block ? "Salvar" : "Criar bloco"}
          </Button>
        </>
      }
    >
      <form id="form-bloco" onSubmit={onSubmit} noValidate>
        <FieldRow>
          <Field label="Nome" required error={errors.name?.message}>
            <Input autoFocus placeholder="Bloco 80" {...form.register("name")} />
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
