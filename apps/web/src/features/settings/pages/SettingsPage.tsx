import { type AppSettings, appSettingsSchema } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import { formatNumber } from "@/shared/lib/format";
import { pickDirty } from "@/shared/lib/forms";
import { emptyToNull } from "@/shared/lib/text";
import {
  Card,
  ErrorState,
  Field,
  FieldRow,
  FormSection,
  Input,
  LoadingRegion,
  PageHeader,
  SaveBar,
  Skeleton,
  Textarea,
  toast,
} from "@/shared/ui";
import { useAppSettings, useSaveAppSettings } from "../api";

type Values = z.output<typeof appSettingsSchema>;
const FIELDS = Object.keys(appSettingsSchema.shape);
const nullable = { setValueAs: emptyToNull };

export function SettingsPage() {
  const settings = useAppSettings();
  return (
    <>
      <PageHeader
        title="Configurações do app"
        description="Textos, contatos e regras padrão que o app do visitante usa."
      />
      {settings.error ? (
        <Card>
          <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
        </Card>
      ) : !settings.data ? (
        <LoadingRegion>
          <Skeleton className="h-[40rem] rounded-[1.75rem]" />
        </LoadingRegion>
      ) : (
        <SettingsForm settings={settings.data} />
      )}
    </>
  );
}

/** Contador "120/1000" ao lado do rótulo dos textos longos. */
function Counter({ value, max }: { value: string | null | undefined; max: number }) {
  return (
    <span className="tabular-nums">
      {formatNumber((value ?? "").length)}/{formatNumber(max)}
    </span>
  );
}

function SettingsForm({ settings }: { settings: AppSettings }) {
  const save = useSaveAppSettings();
  const form = useForm<z.input<typeof appSettingsSchema>, unknown, Values>({
    resolver: zodResolver(appSettingsSchema),
    values: settings,
    resetOptions: { keepDirtyValues: true },
  });
  const { register, formState, control } = form;
  const { errors, isDirty } = formState;
  useUnsavedChangesGuard(isDirty && !save.isPending);
  const [about, parking, tour, hours] = useWatch({
    control,
    name: ["aboutText", "parkingInfo", "tourInfo", "couponDefaultWindowHours"],
  });

  const onSubmit = form.handleSubmit((values) => {
    const body = pickDirty(values, formState.dirtyFields);
    if (Object.keys(body).length === 0) return;
    save.mutate(body, {
      onSuccess: () => {
        form.reset(values);
        toast.success("Configurações salvas. O app usa os novos valores na próxima abertura.");
      },
      onError: (e) => {
        if (!applyApiErrors(e, form.setError, FIELDS)) toast.error(errorMessage(e));
      },
    });
  });

  const hoursN = Number(hours);
  const hoursHint =
    Number.isFinite(hoursN) && hoursN >= 24 && hoursN % 24 === 0
      ? `= ${hoursN / 24} ${hoursN === 24 ? "dia" : "dias"}`
      : "Ex.: 24 = um dia";

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card padding="lg">
        <FormSection
          title="Cupons"
          description="Valor sugerido ao criar uma promoção (dá para mudar em cada uma)."
        >
          <Field
            label="Prazo para usar depois de pegar (horas)"
            required
            hint={hoursHint}
            error={errors.couponDefaultWindowHours?.message}
            className="max-w-xs"
          >
            <Input
              type="number"
              min={1}
              max={720}
              {...register("couponDefaultWindowHours", { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Dias de uma vaga no ar"
            required
            hint="Depois disso, a vaga sai do app sozinha (padrão: 30)."
            error={errors.jobDays?.message}
            className="max-w-xs"
          >
            <Input
              type="number"
              min={1}
              max={90}
              {...register("jobDays", { valueAsNumber: true })}
            />
          </Field>
        </FormSection>

        <FormSection title="Contato e suporte" description="Botões de ajuda no perfil do app.">
          <FieldRow>
            <Field label="WhatsApp do suporte" optional error={errors.supportWhatsapp?.message}>
              <Input
                type="tel"
                placeholder="(22) 99999-0000"
                {...register("supportWhatsapp", nullable)}
              />
            </Field>
            <Field label="E-mail do suporte" optional error={errors.supportEmail?.message}>
              <Input
                type="email"
                placeholder="contato@arp.com.br"
                {...register("supportEmail", nullable)}
              />
            </Field>
          </FieldRow>
        </FormSection>

        <FormSection title="Textos do app" description="Aparecem nas telas de informação do app.">
          <Field
            label="Sobre a ARP"
            action={<Counter value={about} max={2000} />}
            error={errors.aboutText?.message}
          >
            <Textarea rows={5} maxLength={2000} {...register("aboutText")} />
          </Field>
          <Field
            label="Estacionamento"
            hint="Painel “Estacionamento” do mapa."
            action={<Counter value={parking} max={1000} />}
            error={errors.parkingInfo?.message}
          >
            <Textarea rows={3} maxLength={1000} {...register("parkingInfo")} />
          </Field>
          <Field
            label="Tour da ARP"
            hint="Painel “Tour da ARP” e o desafio do tour."
            action={<Counter value={tour} max={1000} />}
            error={errors.tourInfo?.message}
          >
            <Textarea rows={3} maxLength={1000} {...register("tourInfo")} />
          </Field>
        </FormSection>

        <FormSection
          title="Documentos legais"
          description="Links abertos no cadastro e no perfil do app."
        >
          <FieldRow>
            <Field label="Termos de uso" optional error={errors.termsUrl?.message}>
              <Input type="url" placeholder="https://" {...register("termsUrl", nullable)} />
            </Field>
            <Field label="Política de privacidade" optional error={errors.privacyUrl?.message}>
              <Input type="url" placeholder="https://" {...register("privacyUrl", nullable)} />
            </Field>
          </FieldRow>
        </FormSection>
      </Card>
      <SaveBar
        dirty={isDirty}
        saving={save.isPending}
        onReset={() => form.reset()}
        submitLabel="Salvar configurações"
      />
    </form>
  );
}
