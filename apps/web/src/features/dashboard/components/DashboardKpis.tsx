import {
  type DashboardMetric,
  type DashboardOverview,
  type DashboardQuery,
  type Permission,
  ROUTES,
} from "@arp/contracts";
import { useQueryClient } from "@tanstack/react-query";
import {
  Award,
  CalendarDays,
  HandCoins,
  type LucideIcon,
  Percent,
  Ticket,
  TicketCheck,
  TicketPercent,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { formatCents, formatDelta, formatNumber, formatPercent } from "@/shared/lib/format";
import { KpiCard } from "@/shared/ui";
import { prefetchDashboardDetail } from "../api";
import { type KpiDetailInfo, KpiDetailModal } from "./KpiDetailModal";

type Tone = "glass" | "dark" | "green";

interface KpiDef {
  metric: DashboardMetric;
  label: string;
  icon: LucideIcon;
  tone?: Tone;
  format: (v: number) => string;
  deltaKind?: "relative" | "points";
  /** Comparação contra o fim do período anterior (estoque), não o período todo. */
  stock?: boolean;
  hint?: string;
  /** Fonte e fórmula (vão para o modal "de onde vem"). */
  source: string;
  formula: string;
  /** Com loja (lojista ou filtro): rótulo, fonte e cálculo próprios. */
  store?: { label: string; source: string; formula: string };
  link?: (storeId?: string) => { href: string; label: string; permission: Permission | null };
}

const int = (v: number) => formatNumber(v);
const CLAIMS_SOURCE = "Cupons pegos pelos visitantes no app";

const KPIS: KpiDef[] = [
  {
    metric: "visitorsTotal",
    label: "Visitantes cadastrados",
    icon: Users,
    tone: "dark",
    format: int,
    stock: true,
    source: "Cadastros de visitantes no app",
    formula: "Todos os cadastros feitos até o fim do período, desde o início do app",
    store: {
      label: "Clientes da loja",
      source: "Visitantes que já pegaram um cupom da loja",
      formula: "Quem pegou pelo menos um cupom da loja até o fim do período",
    },
    link: () => ({
      href: PATHS.visitors,
      label: "Ver visitantes",
      permission: ROUTES.visitors.list.permission,
    }),
  },
  {
    metric: "visitorsNew",
    label: "Novos cadastros",
    icon: UserPlus,
    format: int,
    source: "Cadastros de visitantes no app",
    formula: "Cadastros feitos dentro do período, pela data do cadastro",
    store: {
      label: "Novos clientes",
      source: "Visitantes que já pegaram um cupom da loja",
      formula: "Quem pegou o primeiro cupom da loja dentro do período",
    },
    link: () => ({
      href: PATHS.visitors,
      label: "Ver visitantes",
      permission: ROUTES.visitors.list.permission,
    }),
  },
  {
    metric: "couponsClaimed",
    label: "Cupons pegos",
    icon: TicketPercent,
    tone: "green",
    format: int,
    source: CLAIMS_SOURCE,
    formula: "Cupons pegos no período, pela data em que o visitante pegou",
    link: (storeId) => ({
      href: PATHS.claimsWith({ storeId }),
      label: "Ver cupons pegos",
      permission: ROUTES.claims.list.permission,
    }),
  },
  {
    metric: "couponsRedeemed",
    label: "Cupons usados",
    icon: TicketCheck,
    format: int,
    source: CLAIMS_SOURCE,
    formula: "Cupons validados no caixa no período, pela data do uso",
    link: (storeId) => ({
      href: PATHS.claimsWith({ storeId, status: "redeemed" }),
      label: "Ver cupons usados",
      permission: ROUTES.claims.list.permission,
    }),
  },
  {
    metric: "redemptionRate",
    label: "Taxa de uso",
    icon: Percent,
    format: formatPercent,
    deltaKind: "points",
    hint: "Usados ÷ pegos no período",
    source: CLAIMS_SOURCE,
    formula:
      "Cupons usados no período ÷ cupons pegos no período (no máximo 100%). Um cupom pego antes do período e usado dentro dele conta como usado",
    link: (storeId) => ({
      href: PATHS.claimsWith({ storeId }),
      label: "Ver cupons pegos",
      permission: ROUTES.claims.list.permission,
    }),
  },
  {
    metric: "savingsCents",
    label: "Economia gerada",
    icon: HandCoins,
    format: (v) => formatCents(v, { whole: true }),
    hint: "Estimada pelos cupons usados",
    source: `${CLAIMS_SOURCE}, com a economia informada em cada promoção`,
    formula:
      "Para cada promoção: cupons usados no período × economia por cupom. Promoção sem economia informada conta R$ 0",
    link: (storeId) => ({
      href: PATHS.claimsWith({ storeId, status: "redeemed" }),
      label: "Ver cupons usados",
      permission: ROUTES.claims.list.permission,
    }),
  },
  {
    metric: "sealsAwarded",
    label: "Selos dados",
    icon: Award,
    tone: "dark",
    format: int,
    source: "Selos conquistados pelos visitantes",
    formula: "Selos ganhos no período, pela data da conquista. Com loja: só os desafios dela",
    link: () => ({
      href: PATHS.earnedSeals(),
      label: "Ver selos conquistados",
      permission: ROUTES.earnedSeals.list.permission,
    }),
  },
  {
    metric: "activeCoupons",
    label: "Promoções ativas",
    icon: Ticket,
    format: int,
    stock: true,
    source: "Promoções cadastradas",
    formula: "Promoções com situação ativa que já começaram e ainda não terminaram, agora",
    link: () => ({
      href: PATHS.coupons,
      label: "Ver promoções",
      permission: ROUTES.coupons.list.permission,
    }),
  },
  {
    metric: "upcomingEvents",
    label: "Próximos eventos",
    icon: CalendarDays,
    format: int,
    hint: "Publicados, nos próximos 30 dias",
    source: "Agenda de eventos",
    formula: "Eventos publicados que acontecem de hoje até daqui a 30 dias (inclui os recorrentes)",
    link: () => ({
      href: PATHS.events,
      label: "Ver eventos",
      permission: ROUTES.events.list.permission,
    }),
  },
];

/**
 * Os 9 indicadores do período, em tons variados (como o copiloto). Clicar
 * num cartão abre o modal com de onde vem o número e as linhas que o formam.
 */
export function DashboardKpis({
  kpis,
  periodLabel,
  query,
  storeName,
  demo = false,
}: {
  kpis: DashboardOverview["kpis"];
  periodLabel: string;
  query: DashboardQuery;
  /** Loja do filtro (ou a do lojista); undefined = todas. */
  storeName?: string;
  /** Há dados fictícios de demonstração somando nos números. */
  demo?: boolean;
}) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [open, setOpen] = useState<DashboardMetric | null>(null);
  const vs = `vs ${periodLabel} anteriores`;
  const detailQuery = (metric: DashboardMetric) => ({ ...query, metric });

  // Com loja, os números de visitantes são os clientes da loja (LOJ-26).
  const defs =
    storeName || query.storeId ? KPIS.map((k) => (k.store ? { ...k, ...k.store } : k)) : KPIS;

  const cards = defs.map((k) => {
    const kpi = kpis[k.metric];
    const delta = formatDelta(kpi.value, kpi.previous, k.deltaKind);
    return (
      <KpiCard
        key={k.metric}
        tone={k.tone}
        label={k.label}
        icon={k.icon}
        value={k.format(kpi.value)}
        delta={delta}
        deltaLabel={k.stock ? "vs fim do período anterior" : vs}
        hint={k.hint}
        demo={demo}
        onClick={() => setOpen(k.metric)}
        onPrefetch={() => prefetchDashboardDetail(qc, detailQuery(k.metric))}
      />
    );
  });

  const def = defs.find((k) => k.metric === open);
  let info: KpiDetailInfo | null = null;
  if (def) {
    const kpi = kpis[def.metric];
    const link = def.link?.(query.storeId);
    info = {
      label: def.label,
      value: def.format(kpi.value),
      previous: kpi.previous === null ? undefined : def.format(kpi.previous),
      deltaText: formatDelta(kpi.value, kpi.previous, def.deltaKind)?.text,
      sources: [
        { label: "Fonte", value: def.source },
        { label: "Cálculo", value: def.formula },
        { label: "Loja", value: storeName ?? "Todas as lojas" },
      ],
      link: link && can(link.permission) ? link : undefined,
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.slice(0, 4)}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {cards.slice(4)}
      </div>
      <KpiDetailModal
        query={open ? detailQuery(open) : null}
        info={info}
        subtitle={`Últimos ${periodLabel} · ${storeName ?? "todas as lojas"}`}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
