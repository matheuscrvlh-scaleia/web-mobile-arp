import { anonymizeVisitorBodySchema, updateVisitorStatusBodySchema } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, EyeOff } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { formatNumber } from "@/shared/lib/format";
import { Button, ConfirmDialog, Field, FormError, Modal, Textarea, toast } from "@/shared/ui";
import { useAnonymizeVisitor, useUpdateVisitorStatus } from "../api";

type Input = z.input<typeof updateVisitorStatusBodySchema>;
type Values = z.output<typeof updateVisitorStatusBodySchema>;

const REASON_MAX = 240;
const SUGGESTIONS = [
  "Uso de várias contas para pegar cupons",
  "Tentativa de fraude no caixa",
  "Pedido do próprio visitante para pausar a conta",
];

/** Bloquear: o motivo é obrigatório (fica no histórico e ajuda quem revisar depois). */
export function BlockVisitorModal({
  open,
  visitor,
  onClose,
}: {
  open: boolean;
  visitor: { id: string; name: string };
  onClose: () => void;
}) {
  const update = useUpdateVisitorStatus(visitor.id);
  const form = useForm<Input, unknown, Values>({
    resolver: zodResolver(updateVisitorStatusBodySchema),
    defaultValues: { status: "blocked", reason: "" },
  });
  const reason = useWatch({ control: form.control, name: "reason" }) ?? "";
  const close = () => {
    form.reset();
    update.reset();
    onClose();
  };

  const onSubmit = form.handleSubmit((body) =>
    update.mutate(body, {
      onSuccess: () => {
        toast.success(`${visitor.name} foi bloqueado.`);
        close();
      },
      onError: (e) => {
        if (!applyApiErrors(e, form.setError, ["reason"]))
          form.setError("root", { message: errorMessage(e) });
      },
    }),
  );

  return (
    <Modal
      open={open}
      onClose={close}
      busy={update.isPending}
      dirty={reason.trim().length > 0}
      alert
      title={`Bloquear ${visitor.name}?`}
      description="A pessoa não consegue mais pegar cupons nem ganhar selos. Os cupons ativos dela deixam de valer no caixa."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={update.isPending}>
            Voltar
          </Button>
          <Button
            type="submit"
            form="form-bloqueio"
            variant="danger"
            icon={Ban}
            loading={update.isPending}
          >
            Bloquear
          </Button>
        </>
      }
    >
      <form id="form-bloqueio" onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <FormError message={form.formState.errors.root?.message} />
        <Field
          label="Motivo"
          required
          action={`${formatNumber(reason.length)}/${REASON_MAX}`}
          hint="Fica registrado no histórico."
          error={form.formState.errors.reason?.message}
        >
          <Textarea autoFocus rows={3} maxLength={REASON_MAX} {...form.register("reason")} />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() =>
                form.setValue("reason", s, { shouldDirty: true, shouldValidate: true })
              }
              className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900"
            >
              {s}
            </button>
          ))}
        </div>
      </form>
    </Modal>
  );
}

/** Desbloquear: volta a usar o app normalmente. */
export function UnblockVisitorDialog({
  open,
  visitor,
  onClose,
}: {
  open: boolean;
  visitor: { id: string; name: string };
  onClose: () => void;
}) {
  const update = useUpdateVisitorStatus(visitor.id);
  const close = () => {
    update.reset();
    onClose();
  };
  return (
    <ConfirmDialog
      open={open}
      onClose={close}
      title={`Desbloquear ${visitor.name}?`}
      description="A pessoa volta a pegar cupons e ganhar selos no app."
      confirmLabel="Desbloquear"
      loading={update.isPending}
      error={update.error}
      onConfirm={() =>
        update.mutate(
          { status: "active", reason: null },
          {
            onSuccess: () => {
              toast.success(`${visitor.name} foi desbloqueado.`);
              close();
            },
          },
        )
      }
    />
  );
}

type AnonymizeInput = z.input<typeof anonymizeVisitorBodySchema>;
type AnonymizeValues = z.output<typeof anonymizeVisitorBodySchema>;

/**
 * LGPD (pedido do titular): apaga nome, e-mail, telefone, foto e apelido.
 * Irreversível: explica o que some e o que fica, e pede o motivo.
 */
export function AnonymizeVisitorModal({
  open,
  visitor,
  onClose,
}: {
  open: boolean;
  visitor: { id: string; name: string };
  onClose: () => void;
}) {
  const anonymize = useAnonymizeVisitor(visitor.id);
  const form = useForm<AnonymizeInput, unknown, AnonymizeValues>({
    resolver: zodResolver(anonymizeVisitorBodySchema),
    defaultValues: { reason: "" },
  });
  const reason = useWatch({ control: form.control, name: "reason" }) ?? "";
  const close = () => {
    form.reset();
    anonymize.reset();
    onClose();
  };

  const onSubmit = form.handleSubmit((body) =>
    anonymize.mutate(body, {
      onSuccess: () => {
        toast.success(`Dados de ${visitor.name} apagados. O registro ficou no histórico.`);
        close();
      },
      onError: (e) => {
        if (!applyApiErrors(e, form.setError, ["reason"]))
          form.setError("root", { message: errorMessage(e) });
      },
    }),
  );

  return (
    <Modal
      open={open}
      onClose={close}
      busy={anonymize.isPending}
      dirty={reason.trim().length > 0}
      alert
      title={`Anonimizar os dados de ${visitor.name}?`}
      description="Use quando a própria pessoa pede para apagar os dados dela (LGPD). Não tem volta."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={anonymize.isPending}>
            Voltar
          </Button>
          <Button
            type="submit"
            form="form-anonimizar"
            variant="danger"
            icon={EyeOff}
            loading={anonymize.isPending}
          >
            Anonimizar dados
          </Button>
        </>
      }
    >
      <form id="form-anonimizar" onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <ul className="flex flex-col gap-1.5 rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
          <li>
            <b className="font-semibold text-neutral-900">Some:</b> nome, e-mail, telefone, foto,
            apelido do ranking e os avisos no celular.
          </li>
          <li>
            <b className="font-semibold text-neutral-900">Fica:</b> os números (cupons, selos,
            trocas), sem dizer de quem são.
          </li>
          <li>A conta fica bloqueada para sempre; a pessoa pode criar outra depois.</li>
        </ul>
        <FormError message={form.formState.errors.root?.message} />
        <Field
          label="Motivo"
          required
          action={`${formatNumber(reason.length)}/${REASON_MAX}`}
          hint="Fica registrado no histórico (ex.: como e quando o pedido chegou)."
          error={form.formState.errors.reason?.message}
        >
          <Textarea autoFocus rows={3} maxLength={REASON_MAX} {...form.register("reason")} />
        </Field>
      </form>
    </Modal>
  );
}
