import type { CounterRedeemBody, CounterRedeemResult } from "@arp/contracts";
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
 * Balcão (Centro de Informações): acha o visitante, confere os pontos, baixa o
 * estoque e grava a troca já entregue. É o único jeito de trocar: o app só
 * mostra a lojinha. O visitante fica travado na transação para não gastar o
 * mesmo ponto duas vezes.
 */
export class CounterRedeemPrizeUseCase {
  constructor(private readonly deps: ClubDeps) {}

  execute(input: CounterRedeemBody, actor: StaffActor): Promise<CounterRedeemResult> {
    const { store, clock, random, audit, uow } = this.deps;
    const now = clock.now();
    return uow.run(async () => {
      const visitor = await store.lockVisitor(input.visitorId);
      if (!visitor) throw new NotFoundError(VISITOR_NOT_FOUND);
      if (visitor.status !== "active") {
        throw new ConflictError("Este visitante está bloqueado e não pode trocar pontos");
      }
      const prize = await store.activePrize(input.prizeId);
      if (!prize) throw new NotFoundError(PRIZE_NOT_FOUND);
      const total = await store.points(input.visitorId, now);
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
              by: actor.id,
              at: now,
            }),
          );
          await audit.log({
            actor,
            action: "prize.redeem_counter",
            entityType: "prize_redemption",
            entityId: id,
            changes: { prizeId: prize.id, visitorId: input.visitorId, points: prize.points },
          });
          const at = now.toISOString();
          return {
            id,
            code,
            prize: { id: prize.id, name: prize.name },
            visitor: { id: input.visitorId, name: visitor.name },
            points: prize.points,
            status: "delivered",
            createdAt: at,
            deliveredAt: at,
            deliveredBy: { id: actor.id, name: actor.name },
            cancelledAt: null,
            totalPoints: await store.points(input.visitorId, now),
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

/** Desfaz uma troca feita por engano: os pontos voltam e o prêmio volta ao estoque. */
export class CancelRedemptionUseCase {
  constructor(private readonly deps: ClubDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    const { store, clock, audit, uow } = this.deps;
    await uow.run(async () => {
      const result = await store.cancel(input.id, actor.id, clock.now());
      if (!result) throw new NotFoundError(REDEMPTION_NOT_FOUND);
      if (result === "done") throw new ConflictError("Esta troca já foi cancelada");
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
