import { highlightStatusSchema, listHighlightsQuerySchema, type Phase } from "@arp/contracts";
import {
  Eye,
  FilterX,
  Info,
  Megaphone,
  MousePointerClick,
  Percent,
  Plus,
  SearchX,
} from "lucide-react";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useUrlState } from "@/shared/hooks";
import { formatNumber } from "@/shared/lib/format";
import {
  Button,
  ButtonLink,
  Can,
  Card,
  EmptyState,
  ErrorState,
  FilterBar,
  KpiCard,
  LoadingRegion,
  PageHeader,
  PHASE_LABEL,
  Segmented,
  Select,
  Skeleton,
  SkeletonGrid,
} from "@/shared/ui";
import { useHighlights } from "../api";
import { HIGHLIGHT_STATUS_LABEL } from "../components/HighlightBadges";
import { ctr, HighlightItem } from "../components/HighlightItem";
import { SortableHighlights } from "../components/SortableHighlights";

const PHASE_OPTIONS: { value: Phase | "all"; label: string }[] = [
  { value: "all", label: "Todas as fases" },
  { value: "live", label: PHASE_LABEL.live },
  { value: "upcoming", label: PHASE_LABEL.upcoming },
  { value: "ended", label: "Encerrados" },
];

export function HighlightsPage() {
  const { can } = useAuth();
  const [query, setQuery] = useUrlState(listHighlightsQuerySchema);
  const filtered = Boolean(query.phase || query.status);
  const highlights = useHighlights(filtered ? query : {});
  const list = highlights.data;
  const live = (list ?? []).filter((h) => h.status === "published" && h.phase === "live");
  const totals = live.reduce(
    (acc, h) => ({ impressions: acc.impressions + h.impressions, clicks: acc.clicks + h.clicks }),
    { impressions: 0, clicks: 0 },
  );

  return (
    <>
      <PageHeader
        title="Destaques"
        description="O carrossel do topo da home do app: destaques da ARP e mídia patrocinada, com período e destino."
        actions={
          <Can permission="highlights.manage">
            <ButtonLink to={PATHS.highlightNew} icon={Plus}>
              Novo destaque
            </ButtonLink>
          </Can>
        }
      />

      {!filtered && (
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {!list ? (
            <SkeletonGrid count={3} className="col-span-full sm:grid-cols-3" itemClassName="h-32" />
          ) : (
            <>
              <KpiCard
                label="No ar agora"
                value={formatNumber(live.length)}
                icon={Megaphone}
                tone="dark"
                hint="Slides que o visitante vê hoje"
              />
              <KpiCard
                label="Impressões (no ar)"
                value={formatNumber(totals.impressions)}
                icon={Eye}
                hint={`${formatNumber(totals.clicks)} cliques`}
              />
              <KpiCard
                label="CTR (no ar)"
                value={ctr(totals)}
                icon={Percent}
                hint="Cliques ÷ impressões"
              />
            </>
          )}
        </div>
      )}

      <FilterBar>
        <Segmented
          label="Fase"
          size="sm"
          options={PHASE_OPTIONS}
          value={query.phase ?? "all"}
          onChange={(v) => setQuery({ phase: v === "all" ? undefined : v })}
        />
        <Select
          aria-label="Situação"
          placeholder="Todas as situações"
          value={query.status ?? ""}
          onChange={(e) => setQuery({ status: e.target.value || undefined })}
          className="w-full sm:w-48"
        >
          {highlightStatusSchema.options.map((s) => (
            <option key={s} value={s}>
              {HIGHLIGHT_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            icon={FilterX}
            onClick={() => setQuery({ phase: undefined, status: undefined })}
          >
            Limpar filtros
          </Button>
        )}
      </FilterBar>

      <Card padding="sm">
        {highlights.error ? (
          <ErrorState error={highlights.error} onRetry={() => void highlights.refetch()} />
        ) : !list ? (
          <LoadingRegion className="gap-2 p-2">
            {Array.from({ length: 4 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: linhas-esqueleto fixas
              <Skeleton key={i} className="h-28 rounded-[1.4rem]" />
            ))}
          </LoadingRegion>
        ) : list.length === 0 ? (
          filtered ? (
            <EmptyState icon={SearchX} title="Nenhum destaque com esses filtros" />
          ) : (
            <EmptyState
              icon={Megaphone}
              title="O carrossel está vazio"
              description="Crie o primeiro destaque: um evento, um cupom, uma loja ou um link."
              action={
                <Can permission="highlights.manage">
                  <ButtonLink to={PATHS.highlightNew} icon={Plus}>
                    Novo destaque
                  </ButtonLink>
                </Can>
              }
            />
          )
        ) : filtered ? (
          <>
            {can("highlights.manage") && (
              <p className="m-2 flex items-center gap-2 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
                <Info className="size-4 shrink-0" aria-hidden />
                Com filtro, a ordem não muda. Limpe os filtros para reordenar o carrossel.
              </p>
            )}
            <ul aria-label="Destaques filtrados" className="flex flex-col gap-2">
              {list.map((h) => (
                <li key={h.id} className="rounded-[1.4rem] p-3 hover:bg-white/50">
                  <HighlightItem highlight={h} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <SortableHighlights highlights={list} canReorder={can("highlights.manage")} />
        )}
      </Card>
      {!filtered && list && list.length > 1 && can("highlights.manage") && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
          <MousePointerClick className="size-3.5" aria-hidden />
          Arraste o destaque (ou use o teclado na alça) para mudar a ordem do carrossel. Salva
          sozinho.
        </p>
      )}
    </>
  );
}
