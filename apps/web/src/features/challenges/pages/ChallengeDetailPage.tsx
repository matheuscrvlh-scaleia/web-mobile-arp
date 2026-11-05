import { Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { SealBadge } from "@/features/seals";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { pickDirty } from "@/shared/lib/forms";
import {
  Button,
  Can,
  ConfirmDialog,
  DemoMark,
  LoadError,
  LoadingRegion,
  PageHeader,
  Skeleton,
  toast,
} from "@/shared/ui";
import { useChallenge, useDeleteChallenge, useUpdateChallenge } from "../api";
import { ChallengeInactiveBadge, ValidationPill } from "../components/ChallengeBadges";
import { CHALLENGE_FORM_FIELDS, ChallengeForm } from "../components/ChallengeForm";
import { QrCodesSection } from "../components/QrCodesSection";

export function ChallengeDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const challenge = useChallenge(id);
  const update = useUpdateChallenge(id);
  const remove = useDeleteChallenge();
  const [confirming, setConfirming] = useState(false);

  if (challenge.error) {
    return (
      <LoadError
        error={challenge.error}
        onRetry={() => void challenge.refetch()}
        icon={Target}
        title="Desafio não encontrado"
        description="Ele pode ter sido apagado ou o endereço está errado."
        back={{ to: PATHS.challenges, label: "Ver desafios" }}
      />
    );
  }

  if (!challenge.data) {
    return (
      <LoadingRegion>
        <Skeleton className="h-12 w-96 max-w-full rounded-full" />
        <Skeleton className="h-56 rounded-[1.75rem]" />
        <Skeleton className="h-96 rounded-[1.75rem]" />
      </LoadingRegion>
    );
  }

  const c = challenge.data;
  const closeConfirm = () => {
    remove.reset();
    setConfirming(false);
  };

  return (
    <>
      <PageHeader
        title={
          <>
            {c.title} <DemoMark show={c.isDemo} />
          </>
        }
        back={{ to: PATHS.challengesOf(c.campaign.id), label: `Desafios · ${c.campaign.name}` }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <SealBadge seal={c.seal} size={28} />
            <span className="font-medium text-neutral-800">Selo {c.seal.name}</span>
            <ValidationPill validation={c.validation} />
            {c.coupon && (
              <span>
                · Baixa do cupom <strong className="font-medium">{c.coupon.title}</strong> (
                {c.coupon.storeName})
              </span>
            )}
            {c.status === "inactive" && <ChallengeInactiveBadge />}
            <span>
              · {c.completionsCount} {c.completionsCount === 1 ? "selo dado" : "selos dados"}
            </span>
          </span>
        }
        actions={
          <Can permission="challenges.manage">
            {/* Travas para apagar (a API confere as mesmas). */}
            {c.completionsCount > 0 ? (
              <span className="max-w-56 text-right text-xs text-neutral-500">
                Já deu selos: não dá para apagar. Para tirar do app, desative.
              </span>
            ) : c.status === "active" ? (
              <span className="max-w-56 text-right text-xs text-neutral-500">
                Para apagar, desative o desafio primeiro (em Exibição, abaixo).
              </span>
            ) : (
              <Button variant="ghost" icon={Trash2} onClick={() => setConfirming(true)}>
                Apagar
              </Button>
            )}
          </Can>
        }
      />

      <div className="flex flex-col gap-6">
        <QrCodesSection challenge={c} />
        <section aria-labelledby="dados-desafio">
          <h2 id="dados-desafio" className="mb-3 text-lg font-semibold tracking-tight">
            Dados do desafio
          </h2>
          <ChallengeForm
            challenge={c}
            readOnly={!can("challenges.manage")}
            submitLabel="Salvar desafio"
            saving={update.isPending}
            onSubmit={(values, { form }) => {
              const { campaignId: _campaign, ...rest } = pickDirty(
                values,
                form.formState.dirtyFields,
              );
              if (Object.keys(rest).length === 0) return;
              update.mutate(rest, {
                onSuccess: () => {
                  form.reset(values);
                  toast.success("Desafio salvo.");
                },
                onError: (e) => {
                  if (!applyApiErrors(e, form.setError, CHALLENGE_FORM_FIELDS))
                    toast.error(errorMessage(e));
                },
              });
            }}
          />
        </section>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={closeConfirm}
        danger
        title={`Apagar "${c.title}"?`}
        description={
          <>
            O desafio
            {c.qrCodesCount > 0
              ? ` e ${c.qrCodesCount === 1 ? "o QR Code" : `os ${c.qrCodesCount} QR Codes`} dele somem`
              : " some"}
            {c.coupon ? ` e o cupom "${c.coupon.title}" deixa de dar selo` : ""}. Não dá para
            desfazer.
          </>
        }
        confirmText={c.title}
        confirmLabel="Apagar desafio"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          remove.mutate(c.id, {
            onSuccess: () => {
              toast.success("Desafio apagado.");
              navigate(PATHS.challengesOf(c.campaign.id));
            },
          })
        }
      />
    </>
  );
}
