import { type Campaign, duplicateCampaignBodySchema } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { plural } from "@/shared/lib/format";
import { Button, DateTimeInput, Field, FieldRow, Input, Modal, toast } from "@/shared/ui";
import { useDuplicateCampaign } from "../api";
import { nextMonthCopy } from "../lib/lifecycle";

type Input_ = z.input<typeof duplicateCampaignBodySchema>;
type Values = z.output<typeof duplicateCampaignBodySchema>;

/**
 * "Duplicar para o próximo mês": nome e período já vêm do mês seguinte; a
 * cópia nasce em rascunho com as faixas e os desafios (sem QR Codes) e abre
 * na aba Desafios.
 */
export function DuplicateCampaignModal({
  campaign,
  onClose,
}: {
  campaign: Campaign;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const duplicate = useDuplicateCampaign(campaign.id);
  const form = useForm<Input_, unknown, Values>({
    resolver: zodResolver(duplicateCampaignBodySchema),
    defaultValues: nextMonthCopy(campaign),
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((body) =>
    duplicate.mutate(body, {
      onSuccess: (copy) => {
        toast.success(
          campaign.challengesCount > 0
            ? `"${copy.name}" criada em rascunho com ${plural(copy.challengesCount, "desafio", "desafios")}. Gere os QR Codes antes de publicar.`
            : `"${copy.name}" criada em rascunho.`,
        );
        onClose();
        navigate(PATHS.campaign(copy.id, "desafios"));
      },
      onError: (e) => {
        if (!applyApiErrors(e, form.setError, ["name", "startsAt", "endsAt"]))
          toast.error(errorMessage(e));
      },
    }),
  );

  return (
    <Modal
      open
      onClose={onClose}
      busy={duplicate.isPending}
      title={`Duplicar ${campaign.name}`}
      description={`A cópia nasce em rascunho, ${campaign.tiers.length > 0 ? `com ${plural(campaign.tiers.length, "faixa", "faixas")} e` : "sem faixas e com"} ${plural(campaign.challengesCount, "desafio", "desafios")} iguais (mesma ordem, selo e loja). QR Codes não são copiados: gere novos.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={duplicate.isPending}>
            Voltar
          </Button>
          <Button type="submit" form="form-duplicar-campanha" loading={duplicate.isPending}>
            Duplicar campanha
          </Button>
        </>
      }
    >
      <form
        id="form-duplicar-campanha"
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-4"
      >
        <Field label="Nome da cópia" required error={errors.name?.message}>
          <Input autoFocus maxLength={80} {...form.register("name")} />
        </Field>
        <FieldRow>
          <Field label="Começa em" required error={errors.startsAt?.message}>
            <Controller
              control={form.control}
              name="startsAt"
              render={({ field }) => (
                <DateTimeInput
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "")}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
          <Field label="Termina em" required error={errors.endsAt?.message}>
            <Controller
              control={form.control}
              name="endsAt"
              render={({ field }) => (
                <DateTimeInput
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "")}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
        </FieldRow>
        <p className="text-xs text-neutral-500">
          Desafios com período próprio andam junto com o início da campanha. Horário de Brasília.
        </p>
      </form>
    </Modal>
  );
}
