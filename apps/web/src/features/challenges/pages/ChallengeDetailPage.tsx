import { FileText, Pause, Play, QrCode, Target } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { useCampaign } from "@/features/campaigns";
import { SealBadge } from "@/features/seals";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useSearchParamOption } from "@/shared/hooks";
import { plural } from "@/shared/lib/format";
import { pickDirty } from "@/shared/lib/forms";
import {
  ActionMenu,
  Button,
  DemoMark,
  LoadError,
  LoadingRegion,
  PageHeader,
  Skeleton,
  type TabItem,
  TabPanel,
  Tabs,
  toast,
} from "@/shared/ui";
import { useChallenge, useUpdateChallenge } from "../api";
import { ChallengeInactiveBadge, ValidationPill } from "../components/ChallengeBadges";
import { CHALLENGE_FORM_FIELDS, ChallengeForm } from "../components/ChallengeForm";
import { QrCodesSection } from "../components/QrCodesSection";
import { useChallengeActions } from "../lib/useChallengeActions";

type Tab = "qr" | "dados";
const TABS: readonly Tab[] = ["qr", "dados"];

/**
 * Detalhe do desafio. Cabeçalho: Pausar/Retomar (na hora, com Desfazer) e
 * "⋯" com Duplicar e Excluir. Corpo em abas: QR Codes (o que mais se faz
 * depois de criar) e Dados (o formulário, sem status nem ordem).
 */
export function ChallengeDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const manage = can("challenges.manage");
  const challenge = useChallenge(id);
  const campaign = useCampaign(challenge.data?.campaign.id);
  const update = useUpdateChallenge(id);
  const actions = useChallengeActions(campaign.data);
  const isQr = challenge.data?.validation !== "auto";
  const [tab, setTab] = useSearchParamOption("aba", TABS, isQr ? "qr" : "dados");

  if (challenge.error) {
    return (
      <LoadError
        error={challenge.error}
        onRetry={() => void challenge.refetch()}
        icon={Target}
        title="Desafio não encontrado"
        description="Ele pode ter sido excluído ou o endereço está errado."
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
  const inactive = c.status === "inactive";
  const backTo = PATHS.campaign(c.campaign.id, "desafios");
  const tabItems: TabItem<Tab>[] = [
    ...(isQr
      ? [{ value: "qr" as const, label: "QR Codes", icon: QrCode, count: c.qrCodesCount }]
      : []),
    { value: "dados", label: "Dados do desafio", icon: FileText },
  ];
  const current: Tab = isQr ? tab : "dados";

  return (
    <>
      <PageHeader
        title={
          <>
            {c.title} <DemoMark show={c.isDemo} />
          </>
        }
        back={{ to: backTo, label: c.campaign.name }}
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
            {inactive && <ChallengeInactiveBadge />}
            <span>· {plural(c.completionsCount, "selo dado", "selos dados")}</span>
            {inactive && c.completionsCount > 0 && (
              <span className="text-neutral-500">· fica guardado no histórico de quem ganhou</span>
            )}
          </span>
        }
        actions={
          manage && (
            <>
              <Button
                variant={inactive ? "primary" : "secondary"}
                icon={inactive ? Play : Pause}
                loading={actions.pendingId === c.id}
                onClick={() => (inactive ? actions.resume(c) : actions.pause(c))}
              >
                {inactive ? "Retomar desafio" : "Pausar desafio"}
              </Button>
              <ActionMenu
                label="Mais"
                ariaLabel={`Mais ações de ${c.title}`}
                // Pausar/Retomar já está no botão ao lado.
                items={actions.menuItems(c, { status: false, onDeleted: () => navigate(backTo) })}
              />
            </>
          )
        }
      />

      <Tabs
        idBase="desafio"
        label="Seções do desafio"
        items={tabItems}
        value={current}
        onChange={setTab}
        className="mb-5"
      />
      <TabPanel idBase="desafio" value={current}>
        {current === "qr" ? (
          <QrCodesSection challenge={c} campaign={campaign.data} />
        ) : (
          <ChallengeForm
            challenge={c}
            readOnly={!manage}
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
        )}
      </TabPanel>
    </>
  );
}
