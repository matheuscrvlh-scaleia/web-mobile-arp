import type { VisitorActor } from "../../../shared/application/actor";
import { isAvailableAt } from "../domain/availability";
import { QrExpiredError, QrInvalidError, SealAlreadyEarnedError } from "../domain/errors";
import { parseQrPayload } from "../domain/qr-code";
import type { ScanResult } from "../domain/repositories";
import type { GamificationDeps } from "./gamification-deps";

export interface ScanAwarded {
  earnedSealId: string;
  sealId: string;
  challengeId: string;
  campaignId: string;
  /** Pontos deste selo. */
  points: number;
  /** Pontos do visitante depois da leitura. */
  totalPoints: number;
}

type Outcome = { result: Exclude<ScanResult, "awarded"> } | ({ result: "awarded" } & ScanAwarded);

/**
 * Visitante lê o QR de um desafio. Toda leitura vira uma linha em qr_scans
 * (analytics e abuso), inclusive as recusadas: o trabalho no banco termina
 * com commit e só depois o erro do resultado é lançado.
 */
export class ScanQrCodeUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(input: { payload: string }, actor: VisitorActor): Promise<ScanAwarded> {
    const outcome = await this.deps.uow.run(() => this.scan(input.payload, actor));
    switch (outcome.result) {
      case "invalid":
        throw new QrInvalidError();
      case "expired":
        throw new QrExpiredError();
      case "duplicate":
        throw new SealAlreadyEarnedError();
      default: {
        const { result: _awarded, ...award } = outcome;
        return award;
      }
    }
  }

  private async scan(payload: string, actor: VisitorActor): Promise<Outcome> {
    const { awards, audit, clock, uow } = this.deps;
    const now = clock.now();
    const record = (qrCodeId: string | null, result: ScanResult) =>
      awards.recordScan({ qrCodeId, visitorId: actor.id, result, at: now });

    const parsed = parseQrPayload(payload);
    const context = parsed ? await awards.findQrContext(parsed.token) : null;
    if (!parsed || !context || !context.qr.isActive || !context.challenge.acceptsQr) {
      await record(context?.qr.id ?? null, "invalid");
      return { result: "invalid" };
    }

    const { qr, challenge, campaign, seal } = context;
    // Telão: código de janela passada (print) também cai aqui. Fora da janela
    // do desafio ou do selo, idem.
    if (
      !campaign.isLiveAt(now) ||
      !challenge.isAvailableAt(now) ||
      !isAvailableAt(seal, now) ||
      !qr.accepts(parsed, now)
    ) {
      await record(qr.id, "expired");
      return { result: "expired" };
    }
    const qrWindow = parsed.window ?? 0;
    const repeat = seal.repeatable ? { qrCodeId: qr.id, qrWindow } : undefined;
    if (await awards.hasEarned(actor.id, challenge.id, repeat)) {
      await record(qr.id, "duplicate");
      return { result: "duplicate" };
    }

    let earnedSealId: string;
    try {
      // Savepoint: leitura simultânea do mesmo visitante cai no unique sem perder a transação.
      earnedSealId = await uow.run(() =>
        awards.award({
          visitorId: actor.id,
          challengeId: challenge.id,
          sealId: challenge.sealId,
          campaignId: campaign.id,
          qrCodeId: qr.id,
          earnedAt: now,
          points: seal.points,
          expiresAt: addMonths(now, seal.validityMonths),
          repeatable: seal.repeatable,
          qrWindow,
        }),
      );
    } catch (err) {
      if (!(err instanceof SealAlreadyEarnedError)) throw err;
      await record(qr.id, "duplicate");
      return { result: "duplicate" };
    }
    await record(qr.id, "awarded");
    await audit.log({
      actor,
      action: "seal.earn",
      entityType: "earned_seal",
      entityId: earnedSealId,
      changes: {
        challengeId: challenge.id,
        sealId: challenge.sealId,
        qrCodeId: qr.id,
        points: seal.points,
      },
    });
    return {
      result: "awarded",
      earnedSealId,
      sealId: challenge.sealId,
      challengeId: challenge.id,
      campaignId: campaign.id,
      points: seal.points,
      totalPoints: await awards.totalPoints(actor.id, now),
    };
  }
}

/** Mesma conta do banco (make_interval(months)): fim de mês cai no último dia. */
export function addMonths(at: Date, months: number): Date {
  const d = new Date(at);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}
