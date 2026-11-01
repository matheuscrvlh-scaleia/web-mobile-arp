import type { PushNotification } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Save, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, type UseFormReturn, useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import { nextRoundedNow } from "@/shared/lib/dates";
import { formatDateTime, formatNumber } from "@/shared/lib/format";
import { emptyToNull } from "@/shared/lib/text";
import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DateTimeInput,
  Field,
  FormSection,
  Input,
  Segmented,
  Textarea,
  toast,
} from "@/shared/ui";
import { useCreateNotification, useScheduleNotification, useUpdateNotification } from "../api";
import {
  cleanNotification,
  NOTIFICATION_FORM_FIELDS,
  type NotificationFormInput,
  type NotificationFormValues,
  notificationFormSchema,
  notificationPatch,
  notificationToFormValues,
} from "../lib/form";
import {
  AudienceEstimate,
  AudiencePicker,
  AudienceStoreSelect,
  useAudienceSummary,
} from "./AudienceField";
import { PushPreview } from "./PushPreview";

type NotificationFormApi = UseFormReturn<NotificationFormInput, unknown, NotificationFormValues>;
type SendMode = "now" | "schedule";

const TITLE_MAX = 65;
const BODY_MAX = 240;
/** Agendar com folga: o envio sai por fila, então "daqui a 1 minuto" já é quase agora. */
const MIN_LEAD_MS = 5 * 60_000;

function scheduleProblem(scheduledAt: string | null): string | null {
  if (!scheduledAt) return "Escolha o dia e a hora do envio.";
  if (new Date(scheduledAt).getTime() < Date.now() + MIN_LEAD_MS)
    return "Agende para daqui a pelo menos 5 minutos.";
  return null;
}

/**
 * Criar ou editar um rascunho, com a prévia do push e o envio (agora ou
 * agendado). Enviar salva o rascunho antes, se preciso.
 */
export function NotificationForm({ notification }: { notification?: PushNotification }) {
  const navigate = useNavigate();
  const create = useCreateNotification();
  const update = useUpdateNotification(notification?.id ?? "");
  const schedule = useScheduleNotification();
  const busy = create.isPending || update.isPending || schedule.isPending;

  const form: NotificationFormApi = useForm<NotificationFormInput, unknown, NotificationFormValues>(
    {
      resolver: zodResolver(notificationFormSchema),
      values: useMemo(() => notificationToFormValues(notification), [notification]),
      resetOptions: { keepDirtyValues: true },
    },
  );
  const { register, control, formState } = form;
  const { errors, isDirty } = formState;
  const { allowLeave } = useUnsavedChangesGuard(isDirty && !busy);
  const [title, body, audience, storeId] = useWatch({
    control,
    name: ["title", "body", "audience", "storeId"],
  });

  const [mode, setMode] = useState<SendMode>("now");
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [pending, setPending] = useState<NotificationFormValues | null>(null);
  const [sendError, setSendError] = useState<unknown>(null);
  const audienceSummary = useAudienceSummary(audience, storeId);

  const onApiError = (e: unknown) => {
    if (!applyApiErrors(e, form.setError, NOTIFICATION_FORM_FIELDS)) toast.error(errorMessage(e));
  };

  const saveDraft = form.handleSubmit((values) => {
    if (!notification) {
      create.mutate(cleanNotification(values), {
        onSuccess: ({ id }) => {
          toast.success("Rascunho salvo.");
          allowLeave();
          navigate(PATHS.notification(id), { replace: true });
        },
        onError: onApiError,
      });
      return;
    }
    const patch = notificationPatch(values, form.formState.dirtyFields);
    if (Object.keys(patch).length === 0) return;
    update.mutate(patch, {
      onSuccess: () => {
        form.reset(values);
        toast.success("Rascunho salvo.");
      },
      onError: onApiError,
    });
  });

  const requestSend = form.handleSubmit((values) => {
    const problem = mode === "schedule" ? scheduleProblem(scheduledAt) : null;
    setScheduleError(problem);
    if (problem) return;
    setSendError(null);
    setPending(values);
  });

  const confirmSend = async () => {
    if (!pending) return;
    let id = notification?.id;
    let created = false;
    try {
      if (!id) {
        id = (await create.mutateAsync(cleanNotification(pending))).id;
        created = true;
      } else {
        const patch = notificationPatch(pending, form.formState.dirtyFields);
        if (Object.keys(patch).length > 0) await update.mutateAsync(patch);
      }
      await schedule.mutateAsync({ id, scheduledAt: mode === "schedule" ? scheduledAt : null });
      toast.success(mode === "schedule" ? "Notificação agendada." : "Notificação enviada.");
      allowLeave();
      navigate(PATHS.notifications);
    } catch (e) {
      if (created && id) {
        // O rascunho existe: leva para ele, para tentar o envio de novo de lá.
        toast.error(`Rascunho salvo, mas o envio falhou: ${errorMessage(e)}`);
        allowLeave();
        navigate(PATHS.notification(id), { replace: true });
        return;
      }
      if (applyApiErrors(e, form.setError, NOTIFICATION_FORM_FIELDS)) {
        setPending(null);
        return;
      }
      setSendError(e);
    }
  };

  const closeConfirm = () => {
    if (busy) return;
    setPending(null);
    setSendError(null);
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <form onSubmit={saveDraft} noValidate className="flex min-w-0 flex-col gap-5">
        <fieldset disabled={busy} className="min-w-0">
          <Card padding="lg">
            <FormSection title="Mensagem" description="Curta e direta: aparece na tela bloqueada.">
              <Field
                label="Título"
                required
                action={`${formatNumber((title ?? "").length)}/${TITLE_MAX}`}
                error={errors.title?.message}
              >
                <Input
                  autoFocus={!notification}
                  maxLength={TITLE_MAX}
                  placeholder="Chopp pela metade na Casa Brava"
                  {...register("title")}
                />
              </Field>
              <Field
                label="Mensagem"
                required
                action={`${formatNumber((body ?? "").length)}/${BODY_MAX}`}
                error={errors.body?.message}
              >
                <Textarea
                  rows={3}
                  maxLength={BODY_MAX}
                  placeholder="Só hoje, até as 23h. Restam poucos cupons!"
                  {...register("body")}
                />
              </Field>
            </FormSection>
            <FormSection title="Público" description="Quem recebe. A estimativa vem da API.">
              <Controller
                control={control}
                name="audience"
                render={({ field }) => (
                  <AudiencePicker value={field.value} onChange={field.onChange} />
                )}
              />
              {audience === "store_followers" && (
                <Controller
                  control={control}
                  name="storeId"
                  render={({ field }) => (
                    <AudienceStoreSelect
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.storeId?.message}
                    />
                  )}
                />
              )}
              <AudienceEstimate audience={audience} storeId={storeId} />
            </FormSection>
            <FormSection title="Ao tocar" description="Tela do app que abre.">
              <Field
                label="Link no app"
                optional
                hint="Ex.: arp://cupom/<id> ou arp://evento/<id>. Vazio abre o início do app."
                error={errors.deepLink?.message}
              >
                <Input
                  className="font-mono"
                  placeholder="arp://"
                  spellCheck={false}
                  {...register("deepLink", { setValueAs: emptyToNull })}
                />
              </Field>
            </FormSection>
          </Card>
        </fieldset>

        <Card>
          <CardHeader
            title="Envio"
            icon={Send}
            description="Salve como rascunho ou mande agora / no horário escolhido."
          />
          <div className="flex flex-col gap-4">
            <Segmented
              label="Quando enviar"
              value={mode}
              onChange={(m) => {
                setMode(m);
                setScheduleError(null);
                if (m === "schedule" && !scheduledAt) setScheduledAt(nextRoundedNow(30));
              }}
              options={[
                { value: "now", label: "Enviar agora", icon: Send },
                { value: "schedule", label: "Agendar", icon: CalendarClock },
              ]}
            />
            {mode === "schedule" && (
              <Field
                label="Dia e hora (Brasília)"
                required
                error={scheduleError ?? undefined}
                className="max-w-xs"
              >
                <DateTimeInput
                  value={scheduledAt}
                  min={new Date().toISOString()}
                  onChange={(v) => {
                    setScheduledAt(v);
                    setScheduleError(null);
                  }}
                />
              </Field>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                variant="secondary"
                icon={Save}
                loading={create.isPending || update.isPending}
                disabled={busy || (Boolean(notification) && !isDirty)}
              >
                Salvar rascunho
              </Button>
              <Button
                variant="primary"
                icon={mode === "schedule" ? CalendarClock : Send}
                disabled={busy}
                onClick={() => void requestSend()}
              >
                {mode === "schedule" ? "Agendar envio" : "Enviar agora"}
              </Button>
            </div>
          </div>
        </Card>
      </form>

      <aside aria-label="Prévia da notificação" className="xl:sticky xl:top-4">
        <PushPreview title={title ?? ""} body={body ?? ""} />
      </aside>

      <ConfirmDialog
        open={pending !== null}
        onClose={closeConfirm}
        onConfirm={() => void confirmSend()}
        title={mode === "schedule" ? "Agendar a notificação?" : "Enviar agora?"}
        description={
          mode === "schedule" && scheduledAt
            ? `Sai em ${formatDateTime(scheduledAt)} para ${audienceSummary}. Dá para cancelar até lá.`
            : `Vai para ${audienceSummary} agora. Depois de enviada, não dá para desfazer.`
        }
        confirmLabel={mode === "schedule" ? "Agendar" : "Enviar agora"}
        danger={mode === "now"}
        loading={busy}
        error={sendError ?? undefined}
      />
    </div>
  );
}
