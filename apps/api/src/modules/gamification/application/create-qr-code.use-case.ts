import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import { QrTokenCollisionError } from "../domain/errors";
import { QrCode } from "../domain/qr-code";
import { CHALLENGE_NOT_FOUND, type GamificationDeps } from "./gamification-deps";

/** 18 bytes → 24 caracteres base64url: adivinhar um token válido é inviável. */
const TOKEN_BYTES = 18;
const MAX_TOKEN_ATTEMPTS = 5;

export class CreateQrCodeUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(
    input: {
      challengeId: string;
      label: string;
      validFrom?: Date | null;
      validUntil?: Date | null;
    },
    actor: StaffActor,
  ): Promise<string> {
    const validFrom = input.validFrom ?? null;
    const validUntil = input.validUntil ?? null;
    QrCode.assertValidWindow(validFrom, validUntil);
    const { challenges, qrCodes, random, audit, uow } = this.deps;

    return uow.run(async () => {
      if (!(await challenges.findById(input.challengeId))) {
        throw new NotFoundError(CHALLENGE_NOT_FOUND);
      }
      for (let attempt = 1; ; attempt++) {
        try {
          // Savepoint: a colisão desfaz só o insert.
          const qr = await uow.run(() =>
            qrCodes.create({
              challengeId: input.challengeId,
              token: random.token(TOKEN_BYTES),
              label: input.label,
              validFrom,
              validUntil,
              status: "active",
            }),
          );
          await audit.log({
            actor,
            action: "qr_code.create",
            entityType: "qr_code",
            entityId: qr.id,
            // snapshot() já tira o token (campo sensível) do histórico.
            changes: snapshot(qr.toState()),
          });
          return qr.id;
        } catch (err) {
          if (!(err instanceof QrTokenCollisionError) || attempt >= MAX_TOKEN_ATTEMPTS) throw err;
        }
      }
    });
  }
}
