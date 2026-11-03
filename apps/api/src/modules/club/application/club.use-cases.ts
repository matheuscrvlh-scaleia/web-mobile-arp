import type { App } from "@arp/contracts";
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
 * Troca pontos por um prêmio: confere os pontos, baixa o estoque e gera o
 * código de retirada. O visitante fica travado na transação para não gastar
 * o mesmo ponto duas vezes.
 */
export class RedeemPrizeUseCase {
  constructor(private readonly deps: ClubDeps) {}

  execute(input: { prizeId: string }, actor: VisitorActor): Promise<App.PrizeRedeemResult> {
    const { store, random, clock, audit, uow } = this.deps;
    const now = clock.now();
    return uow.run(async () => {
      await store.lockVisitor(actor.id);
      const prize = await store.activePrize(input.prizeId);
      if (!prize) throw new NotFoundError(PRIZE_NOT_FOUND);
      const total = await store.points(actor.id, now);
      if (total < prize.points) throw new NotEnoughPointsError(prize.points - total);
      if (!(await store.takeStock(prize.id))) throw new PrizeOutOfStockError();

      for (let attempt = 1; ; attempt++) {
        const code = random.string(REDEMPTION_CODE_ALPHABET, REDEMPTION_CODE_LENGTH);
        try {
          // Savepoint: a colisão do código desfaz só o insert.
          const id = await uow.run(() =>
            store.insertRedemption({
              prizeId: prize.id,
              visitorId: actor.id,
              points: prize.points,
              code,
            }),
          );
          await audit.log({
            actor,
            action: "prize.redeem",
            entityType: "prize_redemption",
            entityId: id,
            changes: { prizeId: prize.id, points: prize.points },
          });
          return {
            code,
            prize: { id: prize.id, name: prize.name },
            points: prize.points,
            totalPoints: await store.points(actor.id, now),
          };
        } catch (err) {
          if (!(err instanceof RedemptionCodeCollisionError) || attempt >= MAX_CODE_ATTEMPTS) {
            throw err;
          }
        }
      }
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
