import type { Highlight } from "@arp/contracts";
import {
  Archive,
  ChevronDown,
  Eye,
  FilterX,
  Info,
  Megaphone,
  MousePointerClick,
  Pencil,
  Percent,
  Plus,
  SearchX,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useSearchParamOption } from "@/shared/hooks";
import { formatNumber } from "@/shared/lib/format";
import { normalize } from "@/shared/lib/text";
import {
  Button,
  ButtonLink,
  Can,
  Card,
  EmptyState,
  ErrorState,
  FilterBar,
  KpiCard,
  type Lifecycle,
  LoadingRegion,
  PageHeader,
  SearchInput,
  Skeleton,
  SkeletonGrid,
  StatusTabs,
  statusTabLabel,
  type TabItem,
} from "@/shared/ui";
import { useHighlights } from "../api";
import { highlightLifecycle } from "../components/HighlightBadges";
import { ctr, HighlightItem } from "../components/HighlightItem";
import { SortableHighlights } from "../components/SortableHighlights";

// Filtro de situação padrão (R2G-11): abas com contador, rótulos do LifecycleBadge.
type Situation = "all" | Lifecycle;
const SITUATIONS: readonly Situation[] = [
  "all",
  "active",
  "scheduled",
  "paused",
  "draft",
  "ended",
  "archived",
];

const matches = (h: Highlight, s: Situation) =>
  s === "all" ? h.status !== "archived" : highlightLifecycle(h) === s;

export function HighlightsPage() {
  const { can } = useAuth();
  const [situation, setSituation] = useSearchParamOption("situacao", SITUATIONS, "all");
  const [search, setSearch] = useState("");
  const term = normalize(search.trim());
  const filtered = situation !== "all" || Boolean(term);
  // A lista é curta (o carrossel): vem inteira e filtra aqui.
  const highlights = useHighlights({});
  const all = highlights.data;
  const tabs: TabItem<Situation>[] = SITUATIONS.map((s) => ({
    value: s,
    label: statusTabLabel(s),
    count: (all ?? []).filter((h) => matches(h, s)).length,
  })).filter((t) => t.value === "all" || t.value === situation || t.count > 0);
  // Sem filtro: arquivados saem da ordem e vão para uma seção recolhida.
  const list = all?.filter(
    (h) => matches(h, situation) && (!term || normalize(h.title).includes(term)),
  );
  const archived = filtered ? [] : (all ?? []).filter((h) => h.status === "archived");
  // Rascunho nunca foi ao ar: fica fora da ordem do carrossel, numa seção própria.
  const drafts = filtered ? [] : (list ?? []).filter((h) => h.status === "draft");
  const ordered = (list ?? []).filter((h) => h.status !== "draft");
  const canManage = can("highlights.manage");
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
        <div data-guia="cartoes" className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {!list ? (
            <SkeletonGrid count={3} className="col-span-full sm:grid-cols-3" itemClassName="h-32" />
          ) : (
            <>
              <KpiCard
                label="Ativos agora"
                value={formatNumber(live.length)}
                icon={Megaphone}
                tone="dark"
                hint="Slides que o visitante vê hoje"
              />
              <KpiCard
                label="Impressões (ativos)"
                value={formatNumber(totals.impressions)}
                icon={Eye}
                hint={`${formatNumber(totals.clicks)} cliques`}
              />
              <KpiCard
                label="CTR (ativos)"
                value={ctr(totals)}
                icon={Percent}
                hint="Cliques ÷ impressões"
              />
            </>
          )}
        </div>
      )}

      <FilterBar className="items-start">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar destaque"
          label="Buscar destaque"
          className="w-full sm:w-64"
        />
        <StatusTabs options={tabs} value={situation} onChange={setSituation} className="mb-0" />
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            icon={FilterX}
            onClick={() => {
              setSituation("all");
              setSearch("");
            }}
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
        ) : list.length === 0 && archived.length === 0 ? (
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
                  <HighlightItem highlight={h} canManage={canManage} />
                </li>
              ))}
            </ul>
          </>
        ) : ordered.length > 0 ? (
          <SortableHighlights highlights={ordered} canReorder={canManage} />
        ) : (
          <p className="p-4 text-sm text-neutral-500">
            Nenhum destaque no carrossel:{" "}
            {drafts.length > 0 ? "publique um rascunho" : "todos estão arquivados"}.
          </p>
        )}
      </Card>
      {drafts.length > 0 && (
        <section aria-label="Rascunhos" className="mt-5">
          <h2 className="flex items-center gap-2 px-2 py-2 text-sm font-medium text-neutral-600">
            <Pencil className="size-4" aria-hidden />
            Rascunhos ({formatNumber(drafts.length)})
            <span className="font-normal text-neutral-400">ainda não entram no carrossel</span>
          </h2>
          <Card padding="sm" className="mt-2">
            <ul aria-label="Destaques em rascunho" className="flex flex-col gap-2">
              {drafts.map((h) => (
                <li key={h.id} className="rounded-[1.4rem] p-3 hover:bg-white/50">
                  <HighlightItem highlight={h} canManage={canManage} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
      {archived.length > 0 && (
        <details className="group mt-5">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full px-2 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 [&::-webkit-details-marker]:hidden">
            <Archive className="size-4" aria-hidden />
            Arquivados ({formatNumber(archived.length)})
            <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
            <span className="font-normal text-neutral-400">fora do carrossel e da ordem</span>
          </summary>
          <Card padding="sm" className="mt-2">
            <ul aria-label="Destaques arquivados" className="flex flex-col gap-2">
              {archived.map((h) => (
                <li key={h.id} className="rounded-[1.4rem] p-3 hover:bg-white/50">
                  <HighlightItem highlight={h} canManage={canManage} />
                </li>
              ))}
            </ul>
          </Card>
        </details>
      )}
      {!filtered && ordered.length > 1 && canManage && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
          <MousePointerClick className="size-3.5" aria-hidden />
          Arraste o destaque (ou use o teclado na alça) para mudar a ordem do carrossel. Salva
          sozinho.
        </p>
      )}
    </>
  );
}
