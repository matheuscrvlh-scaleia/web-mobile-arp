import type { Campaign, Challenge } from "@arp/contracts";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CalendarRange,
  GripVertical,
  Plus,
  SearchX,
  Target,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useSortable } from "@/features/highlights/lib/useSortable";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useIsMobile, useSearchParamOption } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";
import { plural } from "@/shared/lib/format";
import { normalize } from "@/shared/lib/text";
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  SearchInput,
  Segmented,
  SkeletonGrid,
  type TabItem,
  toast,
} from "@/shared/ui";
import { useChallenges, useReorderChallenges } from "../api";
import { useChallengeActions } from "../lib/useChallengeActions";
import { ChallengeListItem } from "./ChallengeListItem";
import { QrBatchModal } from "./QrBatchModal";

type Filter = "todos" | "ativos" | "pausados";
const FILTERS: readonly Filter[] = ["todos", "ativos", "pausados"];
const MATCH: Record<Filter, (c: Challenge) => boolean> = {
  todos: () => true,
  ativos: (c) => c.status === "active",
  pausados: (c) => c.status === "inactive",
};

const byOrder = (a: Challenge, b: Challenge) =>
  a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);

/**
 * Desafios de uma campanha, na ordem do app: filtro Todos/Ativos/Pausados,
 * switch de ativo e menu "⋯" em cada linha, e arrastar para reordenar (com
 * alça de teclado e setas). Mesma lista na aba da campanha e em /desafios.
 */
export function ChallengeList({ campaign }: { campaign: Campaign }) {
  const { can, user } = useAuth();
  const archived = campaign.status === "archived";
  // Campanha arquivada: a lista fica só para leitura (desarquive para editar).
  const manage = can("challenges.manage") && !archived;
  const challenges = useChallenges(campaign.id);
  const reorder = useReorderChallenges(campaign.id);
  const actions = useChallengeActions(campaign);
  const [filter, setFilter] = useSearchParamOption("situacao", FILTERS, "todos");
  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState(false);
  const instructionsId = useId();
  const mobile = useIsMobile();

  const all = useMemo(() => [...(challenges.data ?? [])].sort(byOrder), [challenges.data]);
  const term = normalize(search.trim());
  const rows = all.filter(
    (c) =>
      MATCH[filter](c) &&
      (!term || normalize(`${c.title} ${c.howTo} ${c.seal.name}`).includes(term)),
  );
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);
  const ids = useMemo(() => all.map((c) => c.id), [all]);
  // Só dá para arrastar vendo a lista inteira (com filtro ou busca, a posição engana).
  const canReorder = manage && filter === "todos" && !term && all.length > 1;
  // Cartazes do mês: desafios de QR ativos (o lojista, só os da loja dele).
  const printable = all.filter(
    (c) =>
      c.validation === "qr" &&
      c.status === "active" &&
      (!user?.store || c.store?.id === user.store.id),
  );
  const canBatch =
    !archived &&
    can("qr_codes.generate") &&
    printable.length > 0 &&
    new Date(campaign.endsAt).getTime() > Date.now();
  const sortable = useSortable({
    ids,
    enabled: canReorder,
    labelOf: (id) => byId.get(id)?.title ?? "Desafio",
    onCommit: (next) => {
      const before = ids;
      reorder.mutate(next, {
        onSuccess: () =>
          toast.success("Ordem dos desafios salva.", {
            action: { label: "Desfazer", onClick: () => reorder.mutate(before) },
          }),
        onError: (e) => toast.fromError(e),
      });
    },
  });

  const options: TabItem<Filter>[] = [
    { value: "todos", label: "Todos", count: all.length },
    { value: "ativos", label: "Ativos", count: all.filter(MATCH.ativos).length },
    { value: "pausados", label: "Pausados", count: all.filter(MATCH.pausados).length },
  ];
  const newHref = PATHS.challengeNew(campaign.id);

  if (challenges.error)
    return (
      <Card>
        <ErrorState error={challenges.error} onRetry={() => void challenges.refetch()} />
      </Card>
    );
  if (!challenges.data)
    return <SkeletonGrid count={4} className="grid-cols-1" itemClassName="h-24" />;
  if (all.length === 0)
    return (
      <Card>
        <EmptyState
          icon={Target}
          title="Nenhum desafio nesta campanha"
          description="Cada desafio dá um selo. Comece pelos fáceis de comprovar: tour, descarte, evento, estacionamento."
          action={
            manage && (
              <ButtonLink to={newHref} icon={Plus}>
                Novo desafio
              </ButtonLink>
            )
          }
        />
      </Card>
    );

  return (
    <div className="flex flex-col gap-3">
      {archived && (
        <p className="flex items-center gap-2 rounded-2xl bg-neutral-900/[0.05] px-4 py-3 text-sm text-neutral-700">
          <Archive className="size-4 shrink-0" aria-hidden />
          Campanha arquivada: os desafios ficam só para consulta. Desarquive a campanha para editar.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Segmented
            label="Filtrar desafios"
            size="sm"
            options={options}
            value={filter}
            onChange={setFilter}
          />
          {all.length > 0 && (
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar desafio…"
              label="Buscar desafio"
              className="w-full sm:w-64"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canBatch && (
            <Button
              data-guia="cartazes"
              size="sm"
              variant="secondary"
              icon={CalendarRange}
              onClick={() => setBatch(true)}
            >
              Gerar cartazes do mês
            </Button>
          )}
          {manage && (
            <ButtonLink data-guia="criar" to={newHref} icon={Plus} size="sm">
              Novo desafio
            </ButtonLink>
          )}
        </div>
      </div>
      <p className="text-sm text-neutral-500" aria-live="polite">
        {plural(rows.length, "desafio", "desafios")} · cada um dá um selo
        {canReorder &&
          (mobile
            ? " · use as setas para mudar a ordem no app"
            : " · arraste pela alça para mudar a ordem no app")}
      </p>
      {batch && (
        <QrBatchModal campaign={campaign} challenges={printable} onClose={() => setBatch(false)} />
      )}
      {canReorder && (
        <>
          <p id={instructionsId} className="sr-only">
            Para mover, pressione Espaço na alça, use as setas e pressione Espaço de novo para
            soltar. Esc cancela.
          </p>
          <p aria-live="assertive" className="sr-only">
            {sortable.message}
          </p>
        </>
      )}
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon={SearchX}
            title={
              term
                ? `Nenhum desafio com "${search.trim()}"`
                : filter === "pausados"
                  ? "Nenhum desafio pausado"
                  : "Nenhum desafio ativo"
            }
            description={
              term ? "Confira a grafia ou limpe a busca." : "Escolha outro filtro acima."
            }
          />
        </Card>
      ) : (
        <ol
          data-guia="tabela"
          aria-label={`Desafios de ${campaign.name}`}
          aria-busy={challenges.isFetching || undefined}
          className="flex flex-col gap-3"
        >
          {(canReorder ? sortable.order : rows.map((c) => c.id)).map((id, index) => {
            const c = byId.get(id);
            if (!c) return null;
            const moving = sortable.grabbed === id || sortable.dragging === id;
            return (
              <li
                key={id}
                {...(canReorder ? sortable.itemProps(id) : {})}
                className={cn(
                  "rounded-[1.75rem] transition",
                  moving && "shadow-xl ring-4 ring-marca/30",
                )}
              >
                <ChallengeListItem
                  challenge={c}
                  lead={
                    canReorder ? (
                      <span className="relative z-10 flex shrink-0 flex-col items-center gap-0.5">
                        <IconButton
                          icon={ArrowUp}
                          size="sm"
                          label={`Subir ${c.title}`}
                          disabled={index === 0 || reorder.isPending}
                          onClick={() => sortable.nudge(id, -1)}
                        />
                        <button
                          type="button"
                          ref={sortable.handleRef(id)}
                          aria-label={`Mover ${c.title}, posição ${index + 1} de ${sortable.order.length}`}
                          aria-describedby={instructionsId}
                          aria-pressed={sortable.grabbed === id}
                          onKeyDown={(e) => sortable.onHandleKeyDown(e, id)}
                          className="hidden size-8 cursor-grab place-items-center rounded-full text-neutral-400 hover:bg-neutral-900/[0.06] hover:text-neutral-900 active:cursor-grabbing aria-pressed:bg-neutral-900 aria-pressed:text-white sm:grid"
                        >
                          <GripVertical className="size-4" aria-hidden />
                        </button>
                        <IconButton
                          icon={ArrowDown}
                          size="sm"
                          label={`Descer ${c.title}`}
                          disabled={index === sortable.order.length - 1 || reorder.isPending}
                          onClick={() => sortable.nudge(id, 1)}
                        />
                      </span>
                    ) : (
                      <span
                        aria-hidden
                        className="w-5 shrink-0 text-center text-xs text-neutral-400 tabular-nums"
                      >
                        {all.indexOf(c) + 1}
                      </span>
                    )
                  }
                  menu={manage ? actions.menuItems(c, { row: true }) : undefined}
                  onToggle={
                    manage ? (on) => (on ? actions.resume(c) : actions.pause(c)) : undefined
                  }
                  toggling={actions.pendingId === c.id}
                />
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
