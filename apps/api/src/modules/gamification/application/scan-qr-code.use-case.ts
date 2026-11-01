import type { VisitorActor } from "../../../shared/application/actor";
import { QrExpiredError, QrInvalidError, SealAlreadyEarnedError } from "../domain/errors";
import { parseQrPayload } from "../domain/qr-code";
import type { ScanResult } from "../domain/repositories";
import type { GamificationDeps } from "./gamification-deps";

export interface ScanAwarded {
  earnedSealId: string;
  sealId: string;
  challengeId: string;
  campaignId: string;
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

    const token = parseQrPayload(payload);
    const context = token ? await awards.findQrContext(token) : null;
    if (!context || !context.qr.isActive || !context.challenge.acceptsQr) {
      await record(context?.qr.id ?? null, "invalid");
      return { result: "invalid" };
    }

    const { qr, challenge, campaign } = context;
    if (!campaign.isLiveAt(now) || !qr.isWithinWindow(now)) {
      await record(qr.id, "expired");
      return { result: "expired" };
    }
    if (await awards.hasEarned(actor.id, challenge.id)) {
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
      changes: { challengeId: challenge.id, sealId: challenge.sealId, qrCodeId: qr.id },
    });
    return {
      result: "awarded",
      earnedSealId,
      sealId: challenge.sealId,
      challengeId: challenge.id,
      campaignId: campaign.id,
    };
  }
}
