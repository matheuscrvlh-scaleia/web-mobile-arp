import { createRecyclingItemBodySchema, type RecyclingItem } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { saveInput } from "@/shared/lib/forms";
import {
  Button,
  Field,
  FieldRow,
  IconPicker,
  Input,
  Modal,
  Switch,
  Textarea,
  toast,
} from "@/shared/ui";
import { useSaveRecyclingItem } from "../api";

type Input_ = z.input<typeof createRecyclingItemBodySchema>;
type Values = z.output<typeof createRecyclingItemBodySchema>;

const FIELDS = ["name", "icon", "accepts", "rejects", "becomes", "sortOrder"] as const;

function toValues(i?: RecyclingItem): Input_ {
  return {
    name: i?.name ?? "",
    icon: i?.icon ?? "recycle",
    accepts: i?.accepts ?? "",
    rejects: i?.rejects ?? "",
    becomes: i?.becomes ?? "",
    givesSeal: i?.givesSeal ?? false,
    sortOrder: i?.sortOrder ?? 0,
    active: i?.active ?? true,
  };
}

/** Item do Sustentarp: o que aceita, o que não aceita e o que vira. */
export function RecyclingItemFormModal({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item?: RecyclingItem;
  onClose: () => void;
}) {
  const save = useSaveRecyclingItem();
  const form = useForm<Input_, unknown, Values>({
    resolver: zodResolver(createRecyclingItemBodySchema),
    values: toValues(item),
  });
  const { errors } = form.formState;
  const close = () => {
    form.reset();
    save.reset();
    onClose();
  };
  const onSubmit = form.handleSubmit((values) =>
    save.mutate(saveInput(item?.id, values, form.formState.dirtyFields), {
      onSuccess: () => {
        toast.success(item ? "Item salvo." : "Item criado.");
        close();
      },
      onError: (e) => {
        if (!applyApiErrors(e, form.setError, [...FIELDS])) toast.error(errorMessage(e));
      },
    }),
  );

  return (
    <Modal
      open={open}
      onClose={close}
      busy={save.isPending}
      title={item ? `Editar ${item.name}` : "Novo item do Sustentarp"}
      description="O que o visitante pode descartar no Sustentarp."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-sustentarp" loading={save.isPending}>
            {item ? "Salvar" : "Criar item"}
          </Button>
        </>
      }
    >
      <form id="form-sustentarp" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Nome" required error={errors.name?.message}>
          <Input autoFocus placeholder="Cápsulas de café" {...form.register("name")} />
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
        <Field label="Aceita" optional error={errors.accepts?.message}>
          <Textarea rows={2} maxLength={600} {...form.register("accepts")} />
        </Field>
        <Field label="Não aceita" optional error={errors.rejects?.message}>
          <Textarea rows={2} maxLength={600} {...form.register("rejects")} />
        </Field>
        <Field label="O que vira" optional error={errors.becomes?.message}>
          <Textarea rows={2} maxLength={600} {...form.register("becomes")} />
        </Field>
        <Controller
          control={form.control}
          name="givesSeal"
          render={({ field }) => (
            <Switch
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
              label="Vale selo"
              description="Conta para o desafio de descarte do Clube ARP."
            />
          )}
        />
        <Controller
          control={form.control}
          name="active"
          render={({ field }) => (
            <Switch
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
              label="Aparece no app"
            />
          )}
        />
      </form>
    </Modal>
  );
}
