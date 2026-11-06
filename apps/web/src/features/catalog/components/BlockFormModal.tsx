import { type Block, createBlockBodySchema } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { saveInput } from "@/shared/lib/forms";
import { Button, Field, Input, Modal, toast } from "@/shared/ui";
import { useSaveBlock } from "../api";
import { confirmDiscard } from "./confirm-discard";

type Values = z.output<typeof createBlockBodySchema>;

export function BlockFormModal({
  open,
  block,
  nextOrder = 0,
  onClose,
}: {
  open: boolean;
  block?: Block;
  /** Bloco novo entra no fim da lista (a ordem muda arrastando). */
  nextOrder?: number;
  onClose: () => void;
}) {
  const save = useSaveBlock();
  const form = useForm<z.input<typeof createBlockBodySchema>, unknown, Values>({
    resolver: zodResolver(createBlockBodySchema),
    values: block
      ? { name: block.name, sortOrder: block.sortOrder }
      : { name: "", sortOrder: nextOrder },
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
    save.mutate(saveInput(block?.id, values, form.formState.dirtyFields), {
      onSuccess: () => {
        toast.success(block ? "Bloco salvo." : "Bloco criado.");
        close();
      },
      onError: (e) => {
        if (!applyApiErrors(e, form.setError, ["name"])) toast.error(errorMessage(e));
      },
    }),
  );

  return (
    <Modal
      open={open}
      onClose={() => void tryClose()}
      busy={save.isPending}
      size="sm"
      title={block ? `Editar ${block.name}` : "Novo bloco"}
      description="Os prédios da ARP (ex.: Bloco 80). Aparece em “onde fica” de cada loja."
      footer={
        <>
          <Button variant="secondary" onClick={() => void tryClose()} disabled={save.isPending}>
            Voltar
          </Button>
          <Button type="submit" form="form-bloco" loading={save.isPending}>
            {block ? "Salvar" : "Criar bloco"}
          </Button>
        </>
      }
    >
      <form id="form-bloco" onSubmit={onSubmit} noValidate>
        <Field label="Nome" required error={errors.name?.message}>
          <Input autoFocus placeholder="Bloco 80" {...form.register("name")} />
        </Field>
      </form>
    </Modal>
  );
}
