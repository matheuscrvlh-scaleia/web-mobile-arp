import { BarChart3, FileText, Gift, Target, Trophy } from "lucide-react";
import { useParams } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { CAMPAIGN_TABS, type CampaignTab, PATHS } from "@/shared/config/paths";
import { useSearchParamOption } from "@/shared/hooks";
import { pickDirty } from "@/shared/lib/forms";
import {
  ButtonLink,
  LoadError,
  LoadingRegion,
  PageHeader,
  Skeleton,
  SkeletonGrid,
  type TabItem,
  TabPanel,
  Tabs,
  toast,
} from "@/shared/ui";
import { useCampaign, useUpdateCampaign } from "../api";
import { CampaignStatusBadge } from "../components/CampaignBadges";
import { CAMPAIGN_FORM_FIELDS, CampaignForm } from "../components/CampaignForm";
import { CampaignSummary } from "../components/CampaignSummary";
import { TiersEditor } from "../components/TiersEditor";
import { formatPeriod } from "../lib/period";

const TAB_ITEMS: TabItem<CampaignTab>[] = [
  { value: "resumo", label: "Resumo", icon: BarChart3 },
  { value: "faixas", label: "Faixas de benefício", icon: Gift },
  { value: "dados", label: "Dados", icon: FileText },
];

export function CampaignDetailPage() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const campaign = useCampaign(id);
  const update = useUpdateCampaign(id);
  const [tab, setTab] = useSearchParamOption("aba", CAMPAIGN_TABS, "resumo");
  const readOnly = !can("challenges.manage");

  if (campaign.error) {
    return (
      <LoadError
        error={campaign.error}
        onRetry={() => void campaign.refetch()}
        icon={Trophy}
        title="Campanha não encontrada"
        description="Ela pode ter sido removida ou o endereço está errado."
        back={{ to: PATHS.campaigns, label: "Ver campanhas" }}
      />
    );
  }

  if (!campaign.data) {
    return (
      <LoadingRegion>
        <Skeleton className="h-12 w-96 max-w-full rounded-full" />
        <Skeleton className="h-11 w-80 rounded-full" />
        <SkeletonGrid count={3} className="sm:grid-cols-3" />
        <Skeleton className="h-72 rounded-[1.75rem]" />
      </LoadingRegion>
    );
  }

  const c = campaign.data;
  return (
    <>
      <PageHeader
        title={c.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <CampaignStatusBadge campaign={c} />
            <span>{formatPeriod(c.startsAt, c.endsAt)}</span>
          </span>
        }
        back={{ to: PATHS.campaigns, label: "Campanhas" }}
        actions={
          <ButtonLink to={PATHS.challengesOf(c.id)} variant="secondary" icon={Target}>
            Desafios ({c.challengesCount})
          </ButtonLink>
        }
      />
      <Tabs
        idBase="campanha"
        label="Seções da campanha"
        items={TAB_ITEMS}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />
      <TabPanel idBase="campanha" value={tab}>
        {tab === "resumo" && <CampaignSummary campaign={c} />}
        {tab === "faixas" && <TiersEditor campaign={c} readOnly={readOnly} />}
        {tab === "dados" && (
          <CampaignForm
            campaign={c}
            readOnly={readOnly}
            submitLabel="Salvar campanha"
            saving={update.isPending}
            onSubmit={(values, { form }) => {
              const body = pickDirty(values, form.formState.dirtyFields);
              if (Object.keys(body).length === 0) return;
              update.mutate(body, {
                onSuccess: () => {
                  form.reset(values);
                  toast.success("Campanha salva.");
                },
                onError: (e) => {
                  if (!applyApiErrors(e, form.setError, CAMPAIGN_FORM_FIELDS))
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
