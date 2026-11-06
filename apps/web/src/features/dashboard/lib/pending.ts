import type { PendingItem, PendingKind } from "@arp/contracts";
import {
  Bell,
  CalendarPlus,
  Gift,
  Hourglass,
  type LucideIcon,
  PackageOpen,
  Target,
  TimerReset,
  UserPlus,
} from "lucide-react";
import { PATHS } from "@/shared/config/paths";

export interface PendingView {
  /** Frase curta: "3 cupons aguardando aprovação". */
  title: string;
  /** Exemplos: "Pizza 20%, Burger 2x1 e mais 1". */
  detail: string | null;
  to: string;
  icon: LucideIcon;
  /** Trava alguém (fila de aprovação, sem estoque) ou só lembra. */
  urgent: boolean;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** "Pizza 20%, Burger 2x1 e mais 3" (até 3 nomes). */
function examples(item: PendingItem): string | null {
  const names = item.samples.map((s) => s.name);
  if (names.length === 0) return null;
  const rest = item.count - names.length;
  return rest > 0 ? `${names.join(", ")} e mais ${rest}` : names.join(", ");
}

/** Um só: abre o item; vários: a lista. */
const oneOr = (item: PendingItem, one: (id: string) => string, list: string) =>
  item.count === 1 && item.samples[0] ? one(item.samples[0].id) : list;

function monthName(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  if (!y || !m) return "do mês que vem";
  return new Date(y, m - 1, 15).toLocaleDateString("pt-BR", { month: "long" });
}

const VIEWS: Record<PendingKind, (item: PendingItem) => PendingView> = {
  couponsToReview: (i) => ({
    title: `${i.count} ${plural(i.count, "cupom aguardando", "cupons aguardando")} aprovação`,
    detail: examples(i),
    to: `${PATHS.coupons}?review=pending`,
    icon: Hourglass,
    urgent: true,
  }),
  merchantSignups: (i) => ({
    title: `${i.count} ${plural(i.count, "lojista aguardando", "lojistas aguardando")} aprovação`,
    detail: examples(i),
    to: PATHS.merchants,
    icon: UserPlus,
    urgent: true,
  }),
  prizesOutOfStock: (i) => ({
    title: `${i.count} ${plural(i.count, "prêmio sem estoque", "prêmios sem estoque")} na lojinha`,
    detail: examples(i),
    to: PATHS.club(),
    icon: Gift,
    urgent: true,
  }),
  couponsLowStock: (i) => ({
    title: `${i.count} ${plural(i.count, "promoção com estoque acabando", "promoções com estoque acabando")}`,
    detail: examples(i),
    to: oneOr(i, PATHS.coupon, PATHS.coupons),
    icon: PackageOpen,
    urgent: false,
  }),
  couponsEndingSoon: (i) => ({
    title: `${i.count} ${plural(i.count, "promoção termina", "promoções terminam")} em até 3 dias`,
    detail: examples(i),
    to: oneOr(i, PATHS.coupon, PATHS.coupons),
    icon: TimerReset,
    urgent: false,
  }),
  campaignWithoutChallenges: (i) => ({
    title:
      i.count === 1
        ? `A campanha ${i.samples[0]?.name ?? ""} está no ar sem desafios`
        : `${i.count} campanhas no ar sem desafios`,
    detail: i.count === 1 ? "Sem desafio, ninguém ganha selo este mês." : examples(i),
    to: oneOr(i, (id) => PATHS.campaign(id), PATHS.campaigns),
    icon: Target,
    urgent: false,
  }),
  nextMonthWithoutCampaign: (i) => ({
    title: `A campanha de ${monthName(i.samples[0]?.name ?? "")} ainda não foi criada`,
    detail: "Duplique a campanha deste mês ou crie uma nova.",
    to: PATHS.campaigns,
    icon: CalendarPlus,
    urgent: false,
  }),
  notificationsToday: (i) => ({
    title: `${i.count} ${plural(i.count, "notificação agendada", "notificações agendadas")} para hoje`,
    detail: examples(i),
    to: oneOr(i, PATHS.notification, PATHS.notifications),
    icon: Bell,
    urgent: false,
  }),
};

export const pendingView = (item: PendingItem): PendingView => VIEWS[item.kind](item);

/** Total para o selo do sino. */
export const pendingTotal = (items: readonly PendingItem[]) =>
  items.reduce((n, i) => n + i.count, 0);
