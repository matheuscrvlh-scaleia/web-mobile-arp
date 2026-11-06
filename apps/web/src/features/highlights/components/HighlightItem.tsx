import type { Highlight } from "@arp/contracts";
import { CalendarRange, Eye, Link2, MousePointerClick, Store, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { PATHS } from "@/shared/config/paths";
import { formatDateTime, formatNumber, formatPercent } from "@/shared/lib/format";
import { ActionMenu, Button, StatusBadge, Switch } from "@/shared/ui";
import { TARGET_ISSUE_TEXT } from "./form/TargetPickers";
import { HighlightStateBadge, KindBadge, TARGET_LABEL } from "./HighlightBadges";
import { HighlightSlide } from "./HighlightSlide";
import { useHighlightActions } from "./useHighlightActions";

export const ctr = (h: Pick<Highlight, "impressions" | "clicks">) =>
  h.impressions > 0 ? formatPercent(h.clicks / h.impressions) : "—";

const ISSUE_SHORT = {
  draft: "Destino em rascunho",
  paused: "Destino pausado",
  cancelled: "Destino cancelado",
  ended: "Destino encerrado",
  archived: "Destino arquivado",
  inactive: "Loja desativada",
  missing: "Destino excluído",
} as const;

/**
 * Um destaque na lista: a área toda (miniatura, título, período, destino)
 * abre o destaque; no fim, o "No ar" e o "⋯" (com `canManage`).
 */
export function HighlightItem({
  highlight: h,
  lead,
  canManage = false,
}: {
  highlight: Highlight;
  lead?: ReactNode;
  canManage?: boolean;
}) {
  const target =
    h.targetType === "none"
      ? TARGET_LABEL.none
      : `${TARGET_LABEL[h.targetType]}: ${h.targetLabel ?? h.targetUrl ?? "—"}`;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
      <Link
        to={PATHS.highlight(h.id)}
        draggable={false}
        className="flex min-w-0 flex-1 flex-col gap-3 rounded-[1.1rem] sm:flex-row sm:items-center"
      >
        {lead}
        <HighlightSlide slide={h} size="thumb" className="w-44 shadow-md" />
        <div className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-neutral-900">{h.title}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <KindBadge badge={h.badge} />
            <HighlightStateBadge highlight={h} />
            {h.targetIssue && (
              <span title={`O destino ${TARGET_ISSUE_TEXT[h.targetIssue]}`}>
                <StatusBadge tone="danger" icon={TriangleAlert}>
                  {ISSUE_SHORT[h.targetIssue]}
                </StatusBadge>
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-col gap-0.5 text-xs text-neutral-600">
            <span className="flex items-center gap-1.5">
              <CalendarRange className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                {formatDateTime(h.startsAt)} até {formatDateTime(h.endsAt)}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <Link2 className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{target}</span>
            </span>
            {h.sponsorStore && (
              <span className="flex items-center gap-1.5">
                <Store className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">Patrocínio: {h.sponsorStore.name}</span>
              </span>
            )}
          </div>
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-4 text-right sm:w-56">
          <Metric icon={Eye} label="Impressões" value={formatNumber(h.impressions)} />
          <Metric icon={MousePointerClick} label="Cliques" value={formatNumber(h.clicks)} />
          <Metric label="CTR" value={ctr(h)} />
        </dl>
      </Link>
      {canManage && <RowControls highlight={h} />}
    </div>
  );
}

/** "No ar" (publicado ↔ pausado) e o "⋯"; rascunho e arquivado mostram o botão da vez. */
function RowControls({ highlight: h }: { highlight: Highlight }) {
  const { primary, menu, dialogs, live, toggleLive, busy } = useHighlightActions(h);
  return (
    <div className="flex shrink-0 items-center justify-end gap-2 sm:w-40">
      {primary ? (
        <Button
          size="sm"
          variant="secondary"
          icon={primary.icon}
          onClick={primary.run}
          loading={busy}
        >
          {primary.label}
        </Button>
      ) : (
        <Switch
          checked={live}
          onCheckedChange={toggleLive}
          disabled={busy}
          label={
            <>
              Ativo<span className="sr-only">: {h.title}</span>
            </>
          }
          className="items-center"
        />
      )}
      <ActionMenu size="sm" ariaLabel={`Mais ações de ${h.title}`} items={menu} />
      {dialogs}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon?: typeof Eye; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center justify-end gap-1 text-[11px] text-neutral-500">
        {Icon && <Icon className="size-3" aria-hidden />}
        {label}
      </dt>
      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
