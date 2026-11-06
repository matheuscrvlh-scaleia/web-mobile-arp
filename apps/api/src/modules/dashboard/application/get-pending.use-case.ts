import type { Pending, PendingItem, PendingKind, Permission } from "@arp/contracts";
import type { StaffActor } from "../../../shared/application/actor";
import type { Clock } from "../../../shared/application/ports/clock";

/** Quem pode resolver cada pendência (a permissão da tela que resolve). */
const PERMISSION_OF: Record<PendingKind, Permission> = {
  couponsToReview: "coupons.approve",
  merchantSignups: "merchants.approve",
  couponsLowStock: "coupons.view",
  couponsEndingSoon: "coupons.view",
  campaignWithoutChallenges: "challenges.manage",
  nextMonthWithoutCampaign: "challenges.manage",
  notificationsToday: "notifications.view",
  prizesOutOfStock: "club.manage",
};

/** Só a equipe ARP (sem loja): o lojista não cuida de campanha, push nem lojinha. */
const STAFF_ONLY: ReadonlySet<PendingKind> = new Set([
  "merchantSignups",
  "campaignWithoutChallenges",
  "nextMonthWithoutCampaign",
  "notificationsToday",
  "prizesOutOfStock",
]);

/** Ordem de prioridade: o que trava alguém primeiro. */
export const PENDING_ORDER: readonly PendingKind[] = [
  "couponsToReview",
  "merchantSignups",
  "prizesOutOfStock",
  "couponsLowStock",
  "couponsEndingSoon",
  "campaignWithoutChallenges",
  "nextMonthWithoutCampaign",
  "notificationsToday",
];

export interface PendingRequest {
  kinds: readonly PendingKind[];
  storeId: string | null;
  now: Date;
}

/** Contagens das pendências (SQL no infra), uma por tipo pedido. */
export interface PendingReader {
  pending(request: PendingRequest): Promise<PendingItem[]>;
}

/**
 * O que precisa da atenção da pessoa agora (bloco do Dashboard, contadores
 * do menu e o sino). Cada tipo só entra com a permissão de quem resolve;
 * o lojista vê só a própria loja.
 */
export class GetPendingUseCase {
  constructor(private readonly deps: { reader: PendingReader; clock: Clock }) {}

  async execute(actor: StaffActor): Promise<Pending> {
    const kinds = PENDING_ORDER.filter(
      (k) => actor.permissions.has(PERMISSION_OF[k]) && !(actor.storeId && STAFF_ONLY.has(k)),
    );
    if (kinds.length === 0) return { data: [] };
    const items = await this.deps.reader.pending({
      kinds,
      storeId: actor.storeId,
      now: this.deps.clock.now(),
    });
    return { data: items.filter((i) => i.count > 0) };
  }
}
