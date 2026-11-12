import {
  type App,
  type CounterRedeemBody,
  type CounterRedeemResult,
  PRIZE_PICKUP_DAYS,
} from "@arp/contracts";
import type { StaffActor, VisitorActor } from "../../../shared/application/actor";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { Clock } from "../../../shared/application/ports/clock";
import type { SecureRandom } from "../../../shared/application/ports/secure-random";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { BusinessRuleError, ConflictError, NotFoundError } from "../../../shared/domain/errors";
import {
  NotEnoughPointsError,
  PRIZE_NOT_FOUND,
  PrizeOutOfStockError,
  REDEMPTION_CODE_ALPHABET,
  REDEMPTION_CODE_LENGTH,
  REDEMPTION_NOT_FOUND,
  VISITOR_NOT_FOUND,
} from "../domain/club";
import { type PgClubStore, RedemptionCodeCollisionError } from "../infra/pg-club-store";

export interface ClubDeps {
  store: PgClubStore;
  random: SecureRandom;
  clock: Clock;
  audit: AuditLogger;
  uow: UnitOfWork;
}

const MAX_CODE_ATTEMPTS = 5;
const DAY_MS = 86_400_000;

type Prize = { id: string; name: string; points: number; image_url: string | null };

/**
 * Parte comum das trocas: trava o visitante (o mesmo Trevo não é gasto duas
 * vezes), confere prêmio, saldo e estoque, baixa uma unidade e grava a troca
 * com um código único.
 */
async function redeem(
  deps: ClubDeps,
  input: { visitorId: string; prizeId: string; now: Date },
  delivery: { by: string } | { expiresAt: Date },
): Promise<{ id: string; code: string; prize: Prize; visitorName: string }> {
  const { store, random, uow } = deps;
  const visitor = await store.lockVisitor(input.visitorId);
  if (!visitor) throw new NotFoundError(VISITOR_NOT_FOUND);
  if (visitor.status !== "active") {
    throw new ConflictError("Esta conta está bloqueada e não pode trocar Trevos");
  }
  const prize = await store.activePrize(input.prizeId);
  if (!prize) throw new NotFoundError(PRIZE_NOT_FOUND);
  const total = await store.points(input.visitorId, input.now);
  if (total < prize.points) throw new NotEnoughPointsError(prize.points - total);
  if (!(await store.takeStock(prize.id))) throw new PrizeOutOfStockError();

  for (let attempt = 1; ; attempt++) {
    const code = random.string(REDEMPTION_CODE_ALPHABET, REDEMPTION_CODE_LENGTH);
    try {
      // Savepoint: a colisão do código desfaz só o insert.
      const id = await uow.run(() =>
        store.insertRedemption({
          prizeId: prize.id,
          visitorId: input.visitorId,
          points: prize.points,
          code,
          at: input.now,
          delivery,
        }),
      );
      return { id, code, prize, visitorName: visitor.name };
    } catch (err) {
      if (!(err instanceof RedemptionCodeCollisionError) || attempt >= MAX_CODE_ATTEMPTS) {
        throw err;
      }
    }
  }
}

/**
 * Troca pelo app: reserva os Trevos e a unidade e devolve o código. O
 * visitante mostra o código no Mercado Local, que valida e entrega. Se não
 * retirar em PRIZE_PICKUP_DAYS dias, a troca é cancelada (job) e tudo volta.
 */
export class RedeemPrizeUseCase {
  constructor(private readonly deps: ClubDeps) {}

  execute(input: { prizeId: string }, actor: VisitorActor): Promise<App.RedeemPrizeResult> {
    const { store, clock, audit, uow } = this.deps;
    const now = clock.now();
    const expiresAt = new Date(now.getTime() + PRIZE_PICKUP_DAYS * DAY_MS);
    return uow.run(async () => {
      const r = await redeem(
        this.deps,
        { visitorId: actor.id, prizeId: input.prizeId, now },
        { expiresAt },
      );
      await audit.log({
        actor,
        action: "prize.redeem_app",
        entityType: "prize_redemption",
        entityId: r.id,
        changes: { prizeId: r.prize.id, points: r.prize.points },
      });
      return {
        id: r.id,
        code: r.code,
        prize: { id: r.prize.id, name: r.prize.name, imageUrl: r.prize.image_url },
        points: r.prize.points,
        status: "pending",
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        deliveredAt: null,
        totalPoints: await store.points(actor.id, now),
      };
    });
  }
}

/**
 * Balcão (Centro de Informações): acha o visitante, confere os Trevos, baixa o
 * estoque e grava a troca já entregue.
 */
export class CounterRedeemPrizeUseCase {
  constructor(private readonly deps: ClubDeps) {}

  execute(input: CounterRedeemBody, actor: StaffActor): Promise<CounterRedeemResult> {
    const { store, clock, audit, uow } = this.deps;
    const now = clock.now();
    return uow.run(async () => {
      const r = await redeem(this.deps, { ...input, now }, { by: actor.id });
      await audit.log({
        actor,
        action: "prize.redeem_counter",
        entityType: "prize_redemption",
        entityId: r.id,
        changes: { prizeId: r.prize.id, visitorId: input.visitorId, points: r.prize.points },
      });
      const at = now.toISOString();
      return {
        id: r.id,
        code: r.code,
        prize: { id: r.prize.id, name: r.prize.name },
        visitor: { id: input.visitorId, name: r.visitorName },
        points: r.prize.points,
        status: "delivered",
        createdAt: at,
        expiresAt: null,
        deliveredAt: at,
        deliveredBy: { id: actor.id, name: actor.name },
        cancelledAt: null,
        totalPoints: await store.points(input.visitorId, now),
      };
    });
  }
}

/** Mercado Local: valida o código da troca feita no app e entrega o prêmio. */
export class DeliverRedemptionUseCase {
  constructor(private readonly deps: ClubDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    const { store, clock, audit, uow } = this.deps;
    const now = clock.now();
    await uow.run(async () => {
      const r = await store.lockRedemption(input.id);
      if (!r) throw new NotFoundError(REDEMPTION_NOT_FOUND);
      if (r.status === "delivered") throw new ConflictError("Este prêmio já foi entregue");
      if (r.status === "cancelled") {
        throw new BusinessRuleError(
          "Esta troca foi cancelada (os Trevos voltaram). O visitante pode trocar de novo pelo app.",
        );
      }
      if (r.expiresAt && r.expiresAt <= now) {
        throw new BusinessRuleError(
          "O prazo para retirar venceu. O visitante pode trocar de novo pelo app.",
        );
      }
      await store.markDelivered(r.id, actor.id, now);
      await audit.log({
        actor,
        action: "prize_redemption.deliver",
        entityType: "prize_redemption",
        entityId: r.id,
        changes: {},
      });
    });
  }
}

/** Desfaz uma troca (balcão ou app): os Trevos voltam e o prêmio volta ao estoque. */
export class CancelRedemptionUseCase {
  constructor(private readonly deps: ClubDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    const { store, clock, audit, uow } = this.deps;
    await uow.run(async () => {
      const r = await store.lockRedemption(input.id);
      if (!r) throw new NotFoundError(REDEMPTION_NOT_FOUND);
      if (r.status === "cancelled")
        throw new ConflictError("Esta troca já foi desfeita: os Trevos e o prêmio já voltaram");
      await store.markCancelled(r, actor.id, clock.now());
      await audit.log({
        actor,
        action: "prize_redemption.cancel",
        entityType: "prize_redemption",
        entityId: input.id,
        changes: {},
      });
    });
  }
}

/** O visitante desiste de uma troca que ainda espera retirada. */
export class CancelMyRedemptionUseCase {
  constructor(private readonly deps: ClubDeps) {}

  async execute(input: { id: string }, actor: VisitorActor): Promise<void> {
    const { store, clock, audit, uow } = this.deps;
    await uow.run(async () => {
      const r = await store.lockRedemption(input.id);
      if (!r || r.visitorId !== actor.id) throw new NotFoundError(REDEMPTION_NOT_FOUND);
      if (r.status !== "pending") {
        throw new ConflictError(
          r.status === "delivered" ? "Este prêmio já foi entregue" : "Esta troca já foi cancelada",
        );
      }
      await store.markCancelled(r, null, clock.now());
      await audit.log({
        actor,
        action: "prize_redemption.cancel",
        entityType: "prize_redemption",
        entityId: input.id,
        changes: {},
      });
    });
  }
}

/** Entra (ou troca o apelido) e sai do ranking. O nome real nunca aparece. */
export class SetRankingNicknameUseCase {
  constructor(private readonly deps: ClubDeps) {}

  async execute(input: { nickname: string | null }, actor: VisitorActor): Promise<void> {
    const { store, clock, audit, uow } = this.deps;
    await uow.run(async () => {
      await store.setNickname(actor.id, input.nickname, clock.now());
      await audit.log({
        actor,
        action: input.nickname === null ? "ranking.leave" : "ranking.join",
        entityType: "visitor",
        entityId: actor.id,
        changes: { nickname: input.nickname },
      });
    });
  }
}
