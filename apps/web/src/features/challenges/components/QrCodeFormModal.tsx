import { createQrCodeBodySchema, type QrCode } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { pickDirty } from "@/shared/lib/forms";
import { Button, DateTimeInput, Field, FieldRow, Input, Modal, toast } from "@/shared/ui";
import { useCreateQrCode, useUpdateQrCode } from "../api";

/** O do contrato + a janela coerente (a API também confere). */
const qrFormSchema = createQrCodeBodySchema.refine(
  (v) => !v.validFrom || !v.validUntil || new Date(v.validUntil) > new Date(v.validFrom),
  { message: "O fim precisa ser depois do início", path: ["validUntil"] },
);
type QrFormInput = z.input<typeof qrFormSchema>;
type QrFormValues = z.output<typeof qrFormSchema>;
const FIELDS = ["label", "validFrom", "validUntil"];

/**
 * Gerar ou editar um QR Code: rótulo (onde fica) e, se quiser, a janela
 * em que ele vale. Ao gerar, devolve o QR novo para já imprimir.
 */
export function QrCodeFormModal({
  challengeId,
  qrCode,
  onClose,
  onCreated,
}: {
  challengeId: string;
  /** Sem QR = gerar um novo. */
  qrCode?: QrCode;
  onClose: () => void;
  onCreated?: (qr: QrCode) => void;
}) {
  const create = useCreateQrCode(challengeId);
  const update = useUpdateQrCode();
  const saving = create.isPending || update.isPending;
  const form = useForm<QrFormInput, unknown, QrFormValues>({
    resolver: zodResolver(qrFormSchema),
    defaultValues: {
      label: qrCode?.label ?? "",
      validFrom: qrCode?.validFrom ?? null,
      validUntil: qrCode?.validUntil ?? null,
    },
  });
  const { errors } = form.formState;

  const onError = (e: unknown) => {
    if (!applyApiErrors(e, form.setError, FIELDS)) toast.error(errorMessage(e));
  };

  const onSubmit = form.handleSubmit((values) => {
    if (qrCode) {
      const body = pickDirty(values, form.formState.dirtyFields);
      if (Object.keys(body).length === 0) return onClose();
      update.mutate(
        { id: qrCode.id, body },
        {
          onSuccess: () => {
            toast.success("QR Code salvo.");
            onClose();
          },
          onError,
        },
      );
    } else {
      create.mutate(values, {
        onSuccess: (qr) => {
          toast.success("QR Code gerado.");
          onCreated?.(qr);
          onClose();
        },
        onError,
      });
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      title={qrCode ? "Editar QR Code" : "Gerar QR Code"}
      description="Sem janela, o QR vale enquanto a campanha estiver no ar."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="form-qr" loading={saving}>
            {qrCode ? "Salvar" : "Gerar QR Code"}
          </Button>
        </>
      }
    >
      <form id="form-qr" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field
          label="Rótulo"
          required
          hint="Onde o QR fica. Ex.: Totem da praça central"
          error={errors.label?.message}
        >
          <Input autoFocus maxLength={60} {...form.register("label")} />
        </Field>
        <FieldRow>
          <Field label="Vale a partir de" optional error={errors.validFrom?.message}>
            <Controller
              control={form.control}
              name="validFrom"
              render={({ field }) => (
                <DateTimeInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
          <Field label="Vale até" optional error={errors.validUntil?.message}>
            <Controller
              control={form.control}
              name="validUntil"
              render={({ field }) => (
                <DateTimeInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
        </FieldRow>
        <p className="text-xs text-neutral-500">Horário de Brasília.</p>
      </form>
    </Modal>
  );
}
