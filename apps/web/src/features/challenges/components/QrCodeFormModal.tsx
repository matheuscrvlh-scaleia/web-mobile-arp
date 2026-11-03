import { createQrCodeBodySchema, QR_TTL_OPTIONS, type QrCode } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { pickDirty } from "@/shared/lib/forms";
import { Button, DateTimeInput, Field, Input, Modal, Select, Switch, toast } from "@/shared/ui";
import { useCreateQrCode, useUpdateQrCode } from "../api";

type QrFormInput = z.input<typeof createQrCodeBodySchema>;
type QrFormValues = z.output<typeof createQrCodeBodySchema>;
const FIELDS = ["label", "ttlSeconds", "rotating", "validFrom"];

/**
 * Gerar ou editar um QR Code. Todo QR tem prazo (Fase 2): fixo, vale do
 * início até o prazo; telão, o código muda sozinho a cada prazo e o anterior
 * deixa de valer (print não serve). O prazo não muda depois de gerado.
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
    resolver: zodResolver(createQrCodeBodySchema),
    defaultValues: {
      label: qrCode?.label ?? "",
      ttlSeconds: qrCode?.ttlSeconds ?? 86_400,
      rotating: qrCode?.rotating ?? false,
      validFrom: qrCode?.validFrom ?? null,
    },
  });
  const { errors } = form.formState;

  const onError = (e: unknown) => {
    if (!applyApiErrors(e, form.setError, FIELDS)) toast.error(errorMessage(e));
  };

  const onSubmit = form.handleSubmit((values) => {
    if (qrCode) {
      const { label, validFrom } = pickDirty(values, form.formState.dirtyFields);
      const body = {
        ...(label !== undefined && { label }),
        ...(validFrom !== undefined && { validFrom }),
      };
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
          // Fecha antes: quem abriu pode abrir outro diálogo (imprimir) no lugar.
          onClose();
          onCreated?.(qr);
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
      description="Todo QR Code tem prazo. Para outro prazo, gere outro QR."
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
        <Field
          label="Prazo"
          required
          hint={qrCode ? "O prazo não muda depois de gerado." : undefined}
          error={errors.ttlSeconds?.message}
        >
          <Select disabled={!!qrCode} {...form.register("ttlSeconds", { valueAsNumber: true })}>
            {QR_TTL_OPTIONS.map((o) => (
              <option key={o.seconds} value={o.seconds}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Controller
          control={form.control}
          name="rotating"
          render={({ field }) => (
            <Switch
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
              disabled={!!qrCode}
              label="Modo telão"
              description="O código muda sozinho a cada prazo, na tela. O anterior deixa de valer (print não serve)."
            />
          )}
        />
        <Field
          label="Começa a valer"
          optional
          hint="Vazio = agora. Horário de Brasília."
          error={errors.validFrom?.message}
        >
          <Controller
            control={form.control}
            name="validFrom"
            render={({ field }) => (
              <DateTimeInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
            )}
          />
        </Field>
      </form>
    </Modal>
  );
}
