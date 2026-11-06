import {
  type Campaign,
  type Challenge,
  createQrCodeBodySchema,
  QR_TTL_OPTIONS,
  type QrCode,
} from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, TriangleAlert } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { formatDateTime } from "@/shared/lib/format";
import { pickDirty } from "@/shared/lib/forms";
import { Button, DateTimeInput, Field, Input, Modal, Select, Switch, toast } from "@/shared/ui";
import { useCreateQrCode, useUpdateQrCode } from "../api";
import { challengePeriod, qrCoverage } from "../lib/qr";

type QrFormInput = z.input<typeof createQrCodeBodySchema>;
type QrFormValues = z.output<typeof createQrCodeBodySchema>;
const FIELDS = ["label", "ttlSeconds", "rotating", "validFrom"];

/** Cartaz: o maior prazo que a API aceita (7 dias). Telão: troca a cada 45 s. */
const PRINT_TTL = 7 * 86_400;
const SCREEN_TTL = 45;
/** No telão, prazos longos não fazem sentido (o código fica na tela). */
const SCREEN_MAX_TTL = 3600;
/** Cartaz de 45 s ou 5 min não faz sentido: impresso começa em 24 h. */
const PRINT_MIN_TTL = 86_400;

/**
 * Gerar ou editar um QR Code. Todo QR tem prazo (Fase 2): fixo, vale do
 * início até o prazo (máx. 7 dias); telão, o código muda sozinho a cada
 * prazo e o anterior deixa de valer. O prazo não muda depois de gerado.
 * Na criação, começa a valer quando o desafio começa (ou agora) e avisa se
 * o QR vence antes do fim do desafio.
 */
export function QrCodeFormModal({
  challenge,
  campaign,
  qrCode,
  onClose,
  onCreated,
}: {
  challenge: Challenge;
  /** Para calcular o início padrão e o aviso de vencimento. */
  campaign?: Campaign;
  /** Sem QR = gerar um novo. */
  qrCode?: QrCode;
  onClose: () => void;
  onCreated?: (qr: QrCode) => void;
}) {
  const create = useCreateQrCode(challenge.id);
  const update = useUpdateQrCode();
  const saving = create.isPending || update.isPending;
  const period = campaign ? challengePeriod({ campaign, challenge }) : null;
  // Desafio que ainda vai começar: o QR começa a valer junto (cartaz feito com antecedência).
  const defaultFrom =
    period && period.start > Date.now() ? new Date(period.start).toISOString() : null;
  const form = useForm<QrFormInput, unknown, QrFormValues>({
    resolver: zodResolver(createQrCodeBodySchema),
    defaultValues: {
      label: qrCode?.label ?? "",
      ttlSeconds: qrCode?.ttlSeconds ?? PRINT_TTL,
      rotating: qrCode?.rotating ?? false,
      validFrom: qrCode ? qrCode.validFrom : defaultFrom,
    },
  });
  const { errors } = form.formState;
  const [rotating, ttlSeconds, validFrom] = useWatch({
    control: form.control,
    name: ["rotating", "ttlSeconds", "validFrom"],
  });
  // Editando, o prazo fica travado: mostra todos para o valor salvo aparecer.
  const ttlOptions = qrCode
    ? QR_TTL_OPTIONS
    : QR_TTL_OPTIONS.filter((o) =>
        rotating ? o.seconds <= SCREEN_MAX_TTL : o.seconds >= PRINT_MIN_TTL,
      );

  // Até quando o QR fixo vai valer (prévia do que a API calcula).
  const start = validFrom ? new Date(validFrom).getTime() : Date.now();
  const until = new Date(start + Number(ttlSeconds || 0) * 1000).toISOString();
  const coverage =
    !qrCode && period && !rotating
      ? qrCoverage({ validFrom: validFrom ?? null, validUntil: until, rotating: false }, period)
      : "ok";

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
      description={`Desafio ${challenge.title}`}
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
        <Controller
          control={form.control}
          name="rotating"
          render={({ field }) => (
            <Switch
              checked={field.value ?? false}
              onCheckedChange={(on) => {
                field.onChange(on);
                // Troca o prazo para o que faz sentido no modo escolhido.
                form.setValue("ttlSeconds", on ? SCREEN_TTL : PRINT_TTL, { shouldDirty: true });
              }}
              disabled={!!qrCode}
              label="Modo telão"
              description="Para TV ou tablet: o código muda sozinho e o anterior deixa de valer (foto ou print não serve)."
            />
          )}
        />
        <Field
          label={rotating ? "Troca o código a cada" : "Vale por"}
          required
          hint={
            qrCode
              ? "O prazo não muda depois de gerado. Para outro prazo, gere outro QR."
              : undefined
          }
          error={errors.ttlSeconds?.message}
        >
          <Select disabled={!!qrCode} {...form.register("ttlSeconds", { valueAsNumber: true })}>
            {ttlOptions.map((o) => (
              <option key={o.seconds} value={o.seconds}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        {!rotating && !qrCode && (
          <p className="flex gap-2 rounded-2xl bg-neutral-900/[0.05] px-4 py-3 text-sm text-neutral-700">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              QR impresso vale no máximo 7 dias: assim uma foto do cartaz não dá selo para sempre.
              Para o mês inteiro, use "Gerar cartazes do mês" (um QR por semana, impressos de uma
              vez) ou o modo telão.
            </span>
          </p>
        )}
        <Field
          label="Começa a valer"
          optional
          hint={
            defaultFrom && !qrCode
              ? "Já vem com o início do desafio. Vazio = agora. Horário de Brasília."
              : "Vazio = agora. Horário de Brasília."
          }
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
        {!rotating && !qrCode && (
          <p className="text-sm text-neutral-600" aria-live="polite">
            Vai valer até <strong className="font-semibold">{formatDateTime(until)}</strong>.
          </p>
        )}
        {coverage !== "ok" && period && (
          <p
            aria-live="polite"
            className="flex gap-2 rounded-2xl bg-amber-500/15 px-4 py-3 text-sm text-amber-950"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {coverage === "before" ? (
              <span>
                Este QR vence <strong>antes de o desafio começar</strong> (
                {formatDateTime(new Date(period.start))}). Mude "Começa a valer" para o início do
                desafio.
              </span>
            ) : (
              <span>
                Este QR vence antes do fim do desafio ({formatDateTime(new Date(period.end))}). Gere
                outro QR antes de {formatDateTime(until)} para não ficar sem.
              </span>
            )}
          </p>
        )}
      </form>
    </Modal>
  );
}
