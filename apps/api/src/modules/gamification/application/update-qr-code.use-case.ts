import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import type { QrCodeChanges } from "../domain/qr-code";
import { type GamificationDeps, QR_CODE_NOT_FOUND } from "./gamification-deps";

/** Edita rótulo/janela ou revoga um QR Code. */
export class UpdateQrCodeUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(
    input: { id: string; changes: QrCodeChanges },
    actor: StaffActor,
  ): Promise<{ challengeId: string }> {
    const { qrCodes, audit, uow } = this.deps;
    return uow.run(async () => {
      const qr = await qrCodes.findById(input.id);
      if (!qr) throw new NotFoundError(QR_CODE_NOT_FOUND);
      const before = qr.toState();
      qr.update(input.changes);
      const changes = diff(before, qr.toState());
      if (hasChanges(changes)) {
        await qrCodes.save(qr);
        await audit.log({
          actor,
          action: "qr_code.update",
          entityType: "qr_code",
          entityId: qr.id,
          changes,
        });
      }
      return { challengeId: qr.challengeId };
    });
  }
}
