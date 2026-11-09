import type { Highlight } from "@arp/contracts";
import { Eye, MousePointerClick, Pause, Percent, Play, SearchX } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { formatNumber } from "@/shared/lib/format";
import {
  ActionMenu,
  Button,
  KpiCard,
  LoadError,
  LoadingRegion,
  PageHeader,
  Skeleton,
  SkeletonGrid,
  toast,
} from "@/shared/ui";
import { useHighlight, useHighlights, useUpdateHighlight } from "../api";
import { HighlightForm } from "../components/form/HighlightForm";
import { HighlightStateBadge, KindBadge } from "../components/HighlightBadges";
import { ctr } from "../components/HighlightItem";
import { useHighlightActions } from "../components/useHighlightActions";
import { carouselContext } from "../lib/carousel";
import { HIGHLIGHT_FORM_FIELDS, highlightPatch } from "../lib/form";

export function HighlightDetailPage() {
  const { id = "" } = useParams();
  const highlight = useHighlight(id);

  if (highlight.error) {
    return (
      <LoadError
        error={highlight.error}
        onRetry={() => void highlight.refetch()}
        icon={SearchX}
        title="Destaque não encontrado"
        description="Ele pode ter sido excluído ou o endereço está errado."
        back={{ to: PATHS.highlights, label: "Ver destaques" }}
      />
    );
  }

  if (!highlight.data) {
    return (
      <LoadingRegion>
        <Skeleton className="h-12 w-96 max-w-full rounded-full" />
        <SkeletonGrid count={3} className="sm:grid-cols-3" itemClassName="h-28" />
        <Skeleton className="h-[36rem] rounded-[1.75rem]" />
      </LoadingRegion>
    );
  }

  return <HighlightEditor highlight={highlight.data} />;
}

function HighlightEditor({ highlight }: { highlight: Highlight }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const update = useUpdateHighlight(highlight.id);
  const all = useHighlights();
  const canEdit = can("highlights.manage");
  const actions = useHighlightActions(highlight, { onDeleted: () => navigate(PATHS.highlights) });
  // Botão principal do status: Publicar / Pausar / Retomar / Desarquivar.
  const primary =
    actions.primary ??
    (actions.live
      ? { label: "Pausar", icon: Pause, run: actions.toggleLive }
      : { label: "Retomar", icon: Play, run: actions.toggleLive });
  const { next, total } = carouselContext(all.data, highlight.id);

  return (
    <>
      <PageHeader
        title={highlight.title}
        back={{ to: PATHS.highlights, label: "Destaques" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <KindBadge badge={highlight.badge} />
            <HighlightStateBadge highlight={highlight} />
            {highlight.sponsorStore && <span>Patrocínio: {highlight.sponsorStore.name}</span>}
          </span>
        }
        actions={
          canEdit && (
            <>
              <Button
                variant="brand"
                icon={primary.icon}
                loading={actions.busy}
                onClick={primary.run}
              >
                {primary.label}
              </Button>
              <ActionMenu
                items={actions.menu}
                label="Mais"
                ariaLabel={`Mais ações de ${highlight.title}`}
              />
            </>
          )
        }
      />
      <div data-guia="cartoes" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Impressões" value={formatNumber(highlight.impressions)} icon={Eye} />
        <KpiCard label="Cliques" value={formatNumber(highlight.clicks)} icon={MousePointerClick} />
        <KpiCard
          label="CTR"
          value={ctr(highlight)}
          icon={Percent}
          tone="dark"
          hint="Cliques ÷ impressões"
        />
      </div>
      <HighlightForm
        highlight={highlight}
        next={next}
        total={total}
        readOnly={!canEdit}
        submitLabel="Salvar destaque"
        saving={update.isPending}
        onSubmit={(values, { form }) => {
          const body = highlightPatch(values, form.formState.dirtyFields);
          if (Object.keys(body).length === 0) return;
          update.mutate(body, {
            onSuccess: () => {
              form.reset(values);
              toast.success("Destaque salvo.");
            },
            onError: (e) => {
              if (!applyApiErrors(e, form.setError, HIGHLIGHT_FORM_FIELDS))
                toast.error(errorMessage(e));
            },
          });
        }}
      />
      {actions.dialogs}
    </>
  );
}
