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
  UserSearch,
} from "lucide-react";
import { useState } from "react";
import { Banner } from "@/features/claims/components/RedeemFeedback";
import { errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { useDebouncedValue } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";
import { formatNumber } from "@/shared/lib/format";
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
} from "@/shared/ui";
import { useCounterRedeem, usePrizes, useRedemptionVisitors } from "../api";

/**
 * Tela de balcão do Clube ARP: acha o visitante, mostra o saldo, escolhe o
 * prêmio e troca. O prêmio sai entregue na hora (sem código para conferir).
 */
export function PrizeExchangePage() {
  const [visitor, setVisitor] = useState<RedemptionVisitor | null>(null);
  const [prizeId, setPrizeId] = useState<string | null>(null);
  const [done, setDone] = useState<CounterRedeemResult | null>(null);
  const redeem = useCounterRedeem();

  const reset = () => {
    setVisitor(null);
    setPrizeId(null);
    setDone(null);
    redeem.reset();
  };

  const pickVisitor = (v: RedemptionVisitor | null) => {
    setVisitor(v);
    setPrizeId(null);
    setDone(null);
    redeem.reset();
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
          setVisitor({ ...visitor, points: result.totalPoints });
          setPrizeId(null);
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Validar troca"
        description="Ache o visitante, confira o saldo de pontos e troque por um prêmio da lojinha. O prêmio sai entregue na hora."
        actions={
          <ButtonLink to={PATHS.club("trocas")} icon={PackageCheck} variant="secondary">
            Trocas
          </ButtonLink>
        }
      />
      <div className="flex flex-col gap-4">
        {done && (
          <Banner
            tone="success"
            icon={CircleCheckBig}
            title="Troca feita!"
            action={
              <Button variant="secondary" icon={RotateCcw} onClick={reset}>
                Próximo visitante
              </Button>
            }
          >
            <p>
              <b>{done.prize.name}</b> para {done.visitor.name} · {formatNumber(done.points)} pontos
              · código <b className="font-mono">{done.code}</b>
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Sobraram {formatNumber(done.totalPoints)} pontos. Entregue o prêmio.
            </p>
          </Banner>
        )}
        {redeem.error && (
          <Banner tone="danger" icon={TriangleAlert} title="Não deu para trocar">
            {errorMessage(redeem.error)}
          </Banner>
        )}

        <VisitorStep visitor={visitor} onPick={pickVisitor} />
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
              {formatNumber(visitor.points)} <span className="text-base font-medium">pontos</span>
            </p>
          </div>
          <Button variant="secondary" icon={UserSearch} onClick={() => onPick(null)}>
            Trocar visitante
          </Button>
        </div>
        {visitor.blocked && (
          <p className="mt-4 text-sm font-medium text-red-700">
            Este visitante está bloqueado e não pode trocar pontos.
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
  const list = (prizes.data ?? []).filter((p) => p.active);

  return (
    <Card>
      <CardHeader title="2. Prêmio" description="Só dá para escolher o que o saldo cobre." />
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
    prize.stock <= 0 ? "Esgotado" : missing > 0 ? `Faltam ${formatNumber(missing)} pontos` : null;
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
        <b>{visitor.name}</b> troca <b>{formatNumber(prize.points)} pontos</b> por{" "}
        <b>{prize.name}</b>.
      </p>
      <p className="mt-1 text-sm text-neutral-500">
        Saldo: {formatNumber(visitor.points)} → {formatNumber(visitor.points - prize.points)}{" "}
        pontos.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="brand"
          size="lg"
          icon={ArrowRightLeft}
          loading={loading}
          onClick={onConfirm}
          className="h-16 flex-1 text-base"
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
          Cancelar
        </Button>
      </div>
    </Card>
  );
}
