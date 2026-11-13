import {
  type CounterRedeemResult,
  PRIZE_KIND_LABEL,
  type Prize,
  type RedemptionVisitor,
} from "@arp/contracts";
import {
  ArrowRightLeft,
  CircleCheckBig,
  Gift,
  PackageCheck,
  RotateCcw,
  TriangleAlert,
  Undo2,
  UserSearch,
} from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { Banner } from "@/features/claims/components/RedeemFeedback";
import { errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { useDebouncedValue } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";
import { formatNumber, plural } from "@/shared/lib/format";
import {
  Avatar,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingRegion,
  PageHeader,
  SearchInput,
  Skeleton,
  StatusBadge,
  toast,
} from "@/shared/ui";
import { useCancelRedemption, useCounterRedeem, usePrizes, useRedemptionVisitors } from "../api";
import { DeliverCodeCard } from "../components/DeliverCodeCard";

/**
 * Tela de balcão do Clube ARP, o único lugar onde se troca pontos (o app só
 * mostra a lojinha): acha o visitante, mostra o saldo, escolhe o prêmio que
 * tem no estoque e troca. O prêmio sai entregue na hora. Errou? Desfaz.
 * Com `?visitante=<id>` (vindo do detalhe do visitante) já abre com a pessoa.
 */
export function PrizeExchangePage() {
  const [params, setParams] = useSearchParams();
  const presetId = params.get("visitante") ?? "";
  const preset = useRedemptionVisitors(presetId);
  const [picked, setPicked] = useState<RedemptionVisitor | null>(null);
  const visitor = picked ?? preset.data?.find((v) => v.id === presetId) ?? null;
  const [prizeId, setPrizeId] = useState<string | null>(null);
  const [done, setDone] = useState<CounterRedeemResult | null>(null);
  const redeem = useCounterRedeem();
  const undo = useCancelRedemption();

  const pickVisitor = (v: RedemptionVisitor | null) => {
    setPicked(v);
    setPrizeId(null);
    setDone(null);
    redeem.reset();
    undo.reset();
    if (presetId) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("visitante");
          return next;
        },
        { replace: true },
      );
    }
  };

  const undoLast = () => {
    if (!done || !visitor) return;
    undo.mutate(done.id, {
      onSuccess: () => {
        toast.success(
          `Troca desfeita: ${plural(done.points, "Trevo voltou", "Trevos voltaram")} para ${done.visitor.name} e ${done.prize.name} voltou ao estoque. Recolha o prêmio.`,
        );
        setPicked({ ...visitor, points: visitor.points + done.points });
        setDone(null);
      },
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  const pickPrize = (id: string) => {
    setPrizeId(id);
    setDone(null);
    redeem.reset();
  };

  const confirm = () => {
    if (!visitor || !prizeId) return;
    redeem.mutate(
      { visitorId: visitor.id, prizeId },
      {
        onSuccess: (result) => {
          setDone(result);
          setPicked({ ...visitor, points: result.totalPoints });
          setPrizeId(null);
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Validar e trocar Trevos"
        description="Troca feita no app: valide o código e entregue. Sem app? Ache o visitante, confira o saldo e troque aqui (sai entregue na hora)."
        actions={
          <ButtonLink to={PATHS.club("trocas")} icon={PackageCheck} variant="secondary">
            Ver trocas
          </ButtonLink>
        }
      />
      <div className="flex flex-col gap-4">
        <DeliverCodeCard />
        {done && (
          <Banner
            tone="success"
            icon={CircleCheckBig}
            title="Troca feita!"
            action={
              <span className="flex flex-wrap gap-2">
                <Button variant="ghost" icon={Undo2} loading={undo.isPending} onClick={undoLast}>
                  Desfazer troca
                </Button>
                <Button variant="secondary" icon={RotateCcw} onClick={() => pickVisitor(null)}>
                  Próximo visitante
                </Button>
              </span>
            }
          >
            <p>
              <b>{done.prize.name}</b> para {done.visitor.name} · {formatNumber(done.points)} Trevos
              · comprovante <b className="font-mono">{done.code}</b>
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Sobraram {formatNumber(done.totalPoints)} Trevos. Entregue o prêmio.
            </p>
          </Banner>
        )}
        {redeem.error && (
          <Banner tone="danger" icon={TriangleAlert} title="Não deu para trocar">
            {errorMessage(redeem.error)}
          </Banner>
        )}

        {!visitor && presetId && preset.isLoading ? (
          <LoadingRegion label="Abrindo o visitante…">
            <Skeleton className="h-32 rounded-2xl" />
          </LoadingRegion>
        ) : (
          <VisitorStep visitor={visitor} onPick={pickVisitor} />
        )}
        {visitor && !visitor.blocked && (
          <PrizeStep balance={visitor.points} selected={prizeId} onPick={pickPrize} />
        )}
        {visitor && prizeId && (
          <ConfirmStep
            visitor={visitor}
            prizeId={prizeId}
            loading={redeem.isPending}
            onConfirm={confirm}
            onCancel={() => setPrizeId(null)}
          />
        )}
      </div>
    </>
  );
}

/* 1. Visitante -------------------------------------------------------------- */

function VisitorStep({
  visitor,
  onPick,
}: {
  visitor: RedemptionVisitor | null;
  onPick: (v: RedemptionVisitor | null) => void;
}) {
  const [term, setTerm] = useState("");
  const q = useDebouncedValue(term, 300);
  const search = useRedemptionVisitors(visitor ? "" : q);

  if (visitor) {
    return (
      <Card>
        <CardHeader title="1. Visitante" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={visitor.name} size="lg" muted={visitor.blocked} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{visitor.name}</p>
            <p className="truncate text-sm text-neutral-500">
              {[visitor.email, visitor.phone].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">Saldo</p>
            <p className="text-3xl font-semibold tracking-tight">
              {formatNumber(visitor.points)} <span className="text-base font-medium">Trevos</span>
            </p>
          </div>
          <Button variant="secondary" icon={UserSearch} onClick={() => onPick(null)}>
            Escolher outro visitante
          </Button>
        </div>
        {visitor.blocked && (
          <p className="mt-4 text-sm font-medium text-red-700">
            Este visitante está bloqueado e não pode trocar Trevos.
          </p>
        )}
      </Card>
    );
  }

  const ready = q.trim().length >= 2;
  return (
    <Card>
      <CardHeader
        title="1. Visitante"
        description="Busque pelo nome, e-mail ou telefone que o visitante usa no app."
      />
      <SearchInput
        value={term}
        onChange={setTerm}
        placeholder="Nome, e-mail ou telefone"
        label="Buscar visitante"
        className="max-w-xl"
      />
      <div className="mt-4">
        {!ready ? (
          <EmptyState
            compact
            icon={UserSearch}
            title="Esperando a busca"
            description="Digite 2 letras ou mais."
          />
        ) : search.error ? (
          <ErrorState compact error={search.error} onRetry={() => void search.refetch()} />
        ) : search.isLoading ? (
          <LoadingRegion label="Buscando visitantes…">
            <Skeleton className="h-32 rounded-2xl" />
          </LoadingRegion>
        ) : !search.data?.length ? (
          <EmptyState compact icon={UserSearch} title="Nenhum visitante encontrado" />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100" aria-label="Visitantes">
            {search.data.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => onPick(v)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none"
                >
                  <Avatar name={v.name} muted={v.blocked} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{v.name}</span>
                    <span className="block truncate text-xs text-neutral-500">
                      {[v.email, v.phone].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {v.blocked ? (
                    <StatusBadge tone="danger">Bloqueado</StatusBadge>
                  ) : (
                    <span className="font-semibold tabular-nums">{formatNumber(v.points)} pts</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* 2. Prêmio ----------------------------------------------------------------- */

function PrizeStep({
  balance,
  selected,
  onPick,
}: {
  balance: number;
  selected: string | null;
  onPick: (id: string) => void;
}) {
  const prizes = usePrizes();
  // Esgotado aparece (a equipe vê que acabou), mas por último e sem dar para escolher.
  const list = (prizes.data ?? [])
    .filter((p) => p.active)
    .sort((a, b) => Number(a.stock <= 0) - Number(b.stock <= 0));

  return (
    <Card>
      <CardHeader
        title="2. Prêmio"
        description="Só dá para escolher o que tem no estoque e o saldo cobre."
      />
      {prizes.error ? (
        <ErrorState compact error={prizes.error} onRetry={() => void prizes.refetch()} />
      ) : prizes.isLoading ? (
        <LoadingRegion label="Carregando prêmios…">
          <Skeleton className="h-32 rounded-2xl" />
        </LoadingRegion>
      ) : list.length === 0 ? (
        <EmptyState compact icon={Gift} title="Nenhum prêmio na lojinha" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <PrizeOption
              key={p.id}
              prize={p}
              balance={balance}
              selected={p.id === selected}
              onPick={() => onPick(p.id)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function PrizeOption({
  prize,
  balance,
  selected,
  onPick,
}: {
  prize: Prize;
  balance: number;
  selected: boolean;
  onPick: () => void;
}) {
  const missing = prize.points - balance;
  const blocked =
    prize.stock <= 0 ? "Esgotado" : missing > 0 ? `Faltam ${formatNumber(missing)} Trevos` : null;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={blocked !== null}
      aria-pressed={selected}
      className={cn(
        "flex flex-col gap-1 rounded-2xl border p-4 text-left transition",
        "focus-visible:ring-4 focus-visible:ring-neutral-900/10 focus-visible:outline-none",
        selected
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-white hover:border-neutral-400",
        blocked && "cursor-not-allowed opacity-50 hover:border-neutral-200",
      )}
    >
      <span className="font-medium">{prize.name}</span>
      <span className={cn("text-xs", selected ? "text-neutral-300" : "text-neutral-500")}>
        {PRIZE_KIND_LABEL[prize.kind]} · {formatNumber(prize.stock)} em estoque
      </span>
      <span className="mt-2 text-xl font-semibold tabular-nums">
        {formatNumber(prize.points)} pts
      </span>
      {blocked && <span className="text-xs font-medium text-red-700">{blocked}</span>}
    </button>
  );
}

/* 3. Confirmar -------------------------------------------------------------- */

function ConfirmStep({
  visitor,
  prizeId,
  loading,
  onConfirm,
  onCancel,
}: {
  visitor: RedemptionVisitor;
  prizeId: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const prizes = usePrizes();
  const prize = prizes.data?.find((p) => p.id === prizeId);
  if (!prize) return null;
  return (
    <Card>
      <CardHeader title="3. Confirmar" />
      <p className="text-sm text-neutral-700">
        <b>{visitor.name}</b> troca <b>{formatNumber(prize.points)} Trevos</b> por{" "}
        <b>{prize.name}</b>.
      </p>
      <p className="mt-1 text-sm text-neutral-500">
        Saldo: {formatNumber(visitor.points)} → {formatNumber(visitor.points - prize.points)}{" "}
        Trevos.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="brand"
          size="lg"
          icon={ArrowRightLeft}
          loading={loading}
          onClick={onConfirm}
          className="h-16 w-full shrink-0 text-base sm:w-auto sm:flex-1"
        >
          Trocar e entregar
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={onCancel}
          disabled={loading}
          className="h-16"
        >
          Escolher outro prêmio
        </Button>
      </div>
    </Card>
  );
}
