import { createMapPointBodySchema, type MapPoint } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { Button, ConfirmDialog, Field, IconPicker, Input, Modal, toast } from "@/shared/ui";
import { useCreateMapPoint, useDeleteMapPoint, useUpdateMapPoint } from "../api";

const pointFormSchema = createMapPointBodySchema.pick({ icon: true, label: true });
type PointFormValues = z.output<typeof pointFormSchema>;
const FIELDS = ["icon", "label"];

function PointFields({
  form,
  disabled,
}: {
  form: ReturnType<typeof usePointForm>;
  disabled?: boolean;
}) {
  const { errors } = form.formState;
  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Nome"
        required
        hint="Ex.: Ponto de reciclagem, Início do tour"
        error={errors.label?.message}
      >
        <Input disabled={disabled} {...form.register("label")} />
      </Field>
      <Field label="Ícone" required error={errors.icon?.message}>
        <Controller
          control={form.control}
          name="icon"
          render={({ field }) => (
            <IconPicker value={field.value} onChange={field.onChange} disabled={disabled} />
          )}
        />
      </Field>
    </div>
  );
}

function usePointForm(initial: PointFormValues) {
  return useForm<z.input<typeof pointFormSchema>, unknown, PointFormValues>({
    resolver: zodResolver(pointFormSchema),
    values: initial,
  });
}

/** Ponto novo: abre depois do clique no mapa, com a posição já escolhida. */
export function NewMapPointModal({
  floorId,
  position,
  onClose,
  onCreated,
}: {
  floorId: string;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const create = useCreateMapPoint();
  const form = usePointForm({ icon: "map-pin", label: "" });
  const close = () => {
    form.reset();
    create.reset();
    onClose();
  };
  const onSubmit = form.handleSubmit((values) => {
    if (!position) return;
    create.mutate(
      { ...values, floorId, ...position },
      {
        onSuccess: () => {
          toast.success("Ponto criado.");
          onCreated?.();
          close();
        },
        onError: (e) => {
          if (!applyApiErrors(e, form.setError, FIELDS)) toast.error(errorMessage(e));
        },
      },
    );
  });
  return (
    <Modal
      open={position !== null}
      onClose={close}
      busy={create.isPending}
      title="Novo ponto de referência"
      description="Aparece no mapa do app com o ícone, sem ser uma loja."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-ponto" loading={create.isPending}>
            Criar ponto
          </Button>
        </>
      }
    >
      <form id="form-ponto" onSubmit={onSubmit} noValidate>
        <PointFields form={form} />
      </form>
    </Modal>
  );
}

/** Ponto selecionado: renomear, trocar ícone ou apagar (arrastar é no mapa). */
export function MapPointEditor({
  point,
  readOnly,
  onDeleted,
}: {
  point: MapPoint;
  readOnly: boolean;
  onDeleted: () => void;
}) {
  const update = useUpdateMapPoint(point.floorId);
  const remove = useDeleteMapPoint(point.floorId);
  const [confirming, setConfirming] = useState(false);
  const form = usePointForm({ icon: point.icon, label: point.label });

  const onSubmit = form.handleSubmit((values) =>
    update.mutate(
      { id: point.id, body: values },
      {
        onSuccess: () => {
          form.reset(values);
          toast.success("Ponto salvo.");
        },
        onError: (e) => {
          if (!applyApiErrors(e, form.setError, FIELDS)) toast.error(errorMessage(e));
        },
      },
    ),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <PointFields form={form} disabled={readOnly} />
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            icon={Save}
            loading={update.isPending}
            disabled={!form.formState.isDirty}
          >
            Salvar ponto
          </Button>
          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setConfirming(true)}>
            Apagar
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        onClose={() => {
          setConfirming(false);
          remove.reset();
        }}
        danger
        title={`Apagar “${point.label}”?`}
        description="O ponto some do mapa do app."
        confirmLabel="Apagar"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          remove.mutate(point.id, {
            onSuccess: () => {
              setConfirming(false);
              toast.success("Ponto apagado.");
              onDeleted();
            },
          })
        }
      />
    </form>
  );
}
