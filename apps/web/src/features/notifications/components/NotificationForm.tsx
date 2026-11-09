import type { PushNotification } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Save, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, type UseFormReturn, useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router";
import { useEvent } from "@/features/events";
import { useStoreOptions } from "@/features/stores";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";
import { nextRoundedNow } from "@/shared/lib/dates";
import { formatDateTime, formatNumber } from "@/shared/lib/format";
import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DateTimeInput,
  Field,
  FormSection,
  InfoItem,
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
  AudienceEventSelect,
  AudiencePicker,
  AudienceStoreSelect,
  peopleText,
  useAudienceCount,
} from "./AudienceField";
import {
  DeepLinkField,
  DeepLinkIssue,
  type LinkKind,
  linkKindOf,
  missingTarget,
  useDeepLinkIssue,
  useDeepLinkSummary,
} from "./DeepLinkField";
import { audienceText } from "./NotificationBadges";
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

/** "12/65" que fica vermelho quando passa (colar texto longo não corta em silêncio). */
function Counter({ length, max }: { length: number; max: number }) {
  return (
    <span className={cn(length > max && "font-semibold text-red-600")}>
      {formatNumber(length)}/{max}
      {length > max && <span className="sr-only"> (passou do limite)</span>}
    </span>
  );
}

/**
 * Criar ou editar um rascunho, com a prévia do push e o envio (agendado,
 * o padrão, ou agora). Enviar salva o rascunho antes, se preciso. `copyOf` =
 * "Duplicar" / "Usar como base": abre preenchido com a notificação de origem.
 */
export function NotificationForm({
  notification,
  copyOf,
}: {
  notification?: PushNotification;
  copyOf?: PushNotification;
}) {
  const navigate = useNavigate();
  const create = useCreateNotification();
  const update = useUpdateNotification(notification?.id ?? "");
  const schedule = useScheduleNotification();
  const busy = create.isPending || update.isPending || schedule.isPending;

  const form: NotificationFormApi = useForm<NotificationFormInput, unknown, NotificationFormValues>(
    {
      resolver: zodResolver(notificationFormSchema),
      values: useMemo(
        () => notificationToFormValues(notification ?? copyOf),
        [notification, copyOf],
      ),
      resetOptions: { keepDirtyValues: true },
    },
  );
  const { register, control, formState } = form;
  const { errors, isDirty } = formState;
  const { allowLeave } = useUnsavedChangesGuard(isDirty && !busy);
  const [title, body, audience, storeId, eventId, deepLink] = useWatch({
    control,
    name: ["title", "body", "audience", "storeId", "eventId", "deepLink"],
  });

  const [linkKind, setLinkKind] = useState<LinkKind>(() =>
    linkKindOf((notification ?? copyOf)?.deepLink),
  );
  const [mode, setMode] = useState<SendMode>("schedule");
  const [scheduledAt, setScheduledAt] = useState<string | null>(() => nextRoundedNow(30));
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [pending, setPending] = useState<NotificationFormValues | null>(null);
  const [sendError, setSendError] = useState<unknown>(null);
  const people = useAudienceCount(audience, storeId, eventId);
  const nobody = people === 0;
  const linkSummary = useDeepLinkSummary(deepLink);
  const linkIssue = useDeepLinkIssue(deepLink);
  const audienceEvent = useEvent(
    audience === "event_interested" ? (eventId ?? undefined) : undefined,
  );
  const stores = useStoreOptions({ enabled: audience === "store_followers" });
  const storeName = stores.data?.find((s) => s.id === storeId)?.name ?? "a loja escolhida";
  const isNew = !notification;

  const onApiError = (e: unknown) => {
    if (!applyApiErrors(e, form.setError, NOTIFICATION_FORM_FIELDS)) toast.error(errorMessage(e));
  };

  /** O tipo pede um item (evento, cupom…) e nada foi escolhido: erro no campo. */
  const checkLink = () => {
    const missing = missingTarget(linkKind, form.getValues("deepLink"));
    if (missing) form.setError("deepLink", { message: missing });
    return !missing;
  };

  const saveDraft = form.handleSubmit((values) => {
    if (!checkLink()) return;
    if (isNew) {
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
    if (!checkLink()) return;
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
      toast.success(
        mode === "schedule"
          ? `Agendada para ${formatDateTime(scheduledAt ?? "")}.`
          : "Notificação enviada.",
      );
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

  const sendLabel =
    people === undefined
      ? mode === "schedule"
        ? "Agendar envio"
        : "Enviar agora"
      : `${mode === "schedule" ? "Agendar para" : "Enviar para"} ${peopleText(people)}`;

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <form onSubmit={saveDraft} noValidate className="flex min-w-0 flex-col gap-5">
        <fieldset disabled={busy} className="min-w-0">
          <Card padding="lg">
            <FormSection title="Mensagem" description="Curta e direta: aparece na tela bloqueada.">
              <Field
                label="Título"
                required
                action={<Counter length={(title ?? "").length} max={TITLE_MAX} />}
                error={errors.title?.message}
              >
                <Input
                  autoFocus={isNew && !copyOf}
                  placeholder="Chopp pela metade na Casa Brava"
                  {...register("title")}
                />
              </Field>
              <Field
                label="Mensagem"
                required
                action={<Counter length={(body ?? "").length} max={BODY_MAX} />}
                error={errors.body?.message}
              >
                <Textarea
                  rows={3}
                  placeholder="Só hoje, até as 23h. Restam poucos cupons!"
                  {...register("body")}
                />
              </Field>
            </FormSection>
            <FormSection title="Público" description="Quem recebe, e quantas pessoas são.">
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
              {audience === "event_interested" && (
                <Controller
                  control={control}
                  name="eventId"
                  render={({ field }) => (
                    <AudienceEventSelect
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.eventId?.message}
                    />
                  )}
                />
              )}
              <AudienceEstimate audience={audience} storeId={storeId} eventId={eventId} />
            </FormSection>
            <FormSection title="Ao tocar" description="O que abre quando a pessoa toca no aviso.">
              <Controller
                control={control}
                name="deepLink"
                render={({ field }) => (
                  <DeepLinkField
                    kind={linkKind}
                    onKindChange={(k) => {
                      setLinkKind(k);
                      form.clearErrors("deepLink");
                    }}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      if (v) form.clearErrors("deepLink");
                    }}
                    error={errors.deepLink?.message}
                  />
                )}
              />
            </FormSection>
          </Card>
        </fieldset>

        <Card data-guia="envio">
          <CardHeader
            title="Envio"
            icon={Send}
            description="Agende para a hora certa (dá para cancelar até lá) ou envie agora."
          />
          <div className="flex flex-col gap-4">
            <Segmented
              label="Quando"
              value={mode}
              onChange={(m) => {
                setMode(m);
                setScheduleError(null);
                if (m === "schedule" && !scheduledAt) setScheduledAt(nextRoundedNow(30));
              }}
              options={[
                { value: "schedule", label: "Agendar", icon: CalendarClock },
                { value: "now", label: "Agora", icon: Send },
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
                disabled={busy || (!isNew && !isDirty)}
              >
                Salvar rascunho
              </Button>
              <Button
                variant="primary"
                icon={mode === "schedule" ? CalendarClock : Send}
                disabled={busy || nobody}
                onClick={() => void requestSend()}
              >
                {sendLabel}
              </Button>
            </div>
            {nobody && (
              <p className="text-xs text-amber-700">
                Ninguém recebe com esse público: escolha outro para poder enviar.
              </p>
            )}
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
        title={
          mode === "schedule"
            ? `Agendar “${pending?.title ?? ""}”?`
            : `Enviar “${pending?.title ?? ""}” agora?`
        }
        description={
          mode === "schedule"
            ? "Dá para cancelar até a hora do envio."
            : "Sai na hora, para todo o público. Depois de enviada, não dá para desfazer."
        }
        confirmLabel={`${mode === "schedule" ? "Agendar para" : "Enviar para"} ${peopleText(people)}`}
        cancelLabel="Voltar e revisar"
        danger={mode === "now"}
        loading={busy}
        error={sendError ?? undefined}
      >
        {pending && (
          <div className="grid grid-cols-1 gap-3 rounded-2xl bg-neutral-900/[0.04] p-4 sm:grid-cols-2">
            <InfoItem label="Público">
              {audienceText({
                audience: pending.audience,
                store: pending.storeId ? { id: pending.storeId, name: storeName } : null,
                event: pending.eventId
                  ? { id: pending.eventId, name: audienceEvent.data?.title ?? "…" }
                  : null,
              })}
            </InfoItem>
            <InfoItem label="Chega a">
              {people === undefined ? "—" : `cerca de ${peopleText(people)}`}
            </InfoItem>
            <InfoItem label="Quando">
              {mode === "schedule" && scheduledAt ? formatDateTime(scheduledAt) : "Agora"}
            </InfoItem>
            <div className="sm:col-span-2">
              <InfoItem label="Ao tocar">
                <span className="whitespace-normal">{linkSummary}</span>
              </InfoItem>
            </div>
            {linkIssue && (
              <div className="sm:col-span-2">
                <DeepLinkIssue text={linkIssue} />
              </div>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
