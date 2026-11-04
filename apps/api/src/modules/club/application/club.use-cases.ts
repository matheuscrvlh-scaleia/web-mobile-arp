import type { App, CounterRedeemBody, CounterRedeemResult } from "@arp/contracts";
import type { StaffActor, VisitorActor } from "../../../shared/application/actor";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { Clock } from "../../../shared/application/ports/clock";
import type { SecureRandom } from "../../../shared/application/ports/secure-random";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { ConflictError, NotFoundError } from "../../../shared/domain/errors";
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

/**
 * Núcleo da troca (dentro da transação, com o visitante já travado): confere
 * os pontos, baixa o estoque e grava a troca com código. Com `delivered`, a
 * troca já sai entregue (balcão).
 */
async function redeem(
  deps: ClubDeps,
  input: { prizeId: string; visitorId: string; now: Date },
  actor: VisitorActor | StaffActor,
  delivered?: { by: string; at: Date },
) {
  const { store, random, audit, uow } = deps;
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
          ...(delivered ? { delivered } : {}),
        }),
      );
      await audit.log({
        actor,
        action: delivered ? "prize.redeem_counter" : "prize.redeem",
        entityType: "prize_redemption",
        entityId: id,
        changes: { prizeId: prize.id, visitorId: input.visitorId, points: prize.points },
      });
      return {
        id,
        code,
        prize: { id: prize.id, name: prize.name },
        points: prize.points,
        totalPoints: await store.points(input.visitorId, input.now),
      };
    } catch (err) {
      if (!(err instanceof RedemptionCodeCollisionError) || attempt >= MAX_CODE_ATTEMPTS) {
        throw err;
      }
    }
  }
}

/**
 * App: o visitante troca pontos por um prêmio e recebe o código de retirada.
 * Fica travado na transação para não gastar o mesmo ponto duas vezes.
 */
export class RedeemPrizeUseCase {
  constructor(private readonly deps: ClubDeps) {}

  execute(input: { prizeId: string }, actor: VisitorActor): Promise<App.PrizeRedeemResult> {
    const { store, clock, uow } = this.deps;
    const now = clock.now();
    return uow.run(async () => {
      await store.lockVisitor(actor.id);
      const { code, prize, points, totalPoints } = await redeem(
        this.deps,
        { prizeId: input.prizeId, visitorId: actor.id, now },
        actor,
      );
      return { code, prize, points, totalPoints };
    });
  }
}

/**
 * Balcão (Centro de Informações): acha o visitante, troca os pontos dele pelo
 * prêmio e entrega na hora, sem código para conferir depois.
 */
export class CounterRedeemPrizeUseCase {
  constructor(private readonly deps: ClubDeps) {}

  execute(input: CounterRedeemBody, actor: StaffActor): Promise<CounterRedeemResult> {
    const { store, clock, uow } = this.deps;
    const now = clock.now();
    return uow.run(async () => {
      const visitor = await store.lockVisitor(input.visitorId);
      if (!visitor) throw new NotFoundError(VISITOR_NOT_FOUND);
      if (visitor.status !== "active") {
        throw new ConflictError("Este visitante está bloqueado e não pode trocar pontos");
      }
      const r = await redeem(
        this.deps,
        { prizeId: input.prizeId, visitorId: input.visitorId, now },
        actor,
        { by: actor.id, at: now },
      );
      const at = now.toISOString();
      return {
        id: r.id,
        code: r.code,
        prize: r.prize,
        visitor: { id: input.visitorId, name: visitor.name },
        points: r.points,
        status: "delivered",
        createdAt: at,
        deliveredAt: at,
        totalPoints: r.totalPoints,
      };
    });
  }
}

/** Centro de Informações entrega o prêmio (confere o código na lista). */
export class DeliverRedemptionUseCase {
  constructor(private readonly deps: ClubDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    const { store, clock, audit, uow } = this.deps;
    await uow.run(async () => {
      const result = await store.deliver(input.id, actor.id, clock.now());
      if (!result) throw new NotFoundError(REDEMPTION_NOT_FOUND);
      if (result === "done") throw new ConflictError("Esta troca já foi entregue ou cancelada");
      await audit.log({
        actor,
        action: "prize_redemption.deliver",
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
