import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { assertStoreAccess } from "../../../shared/application/store-scope";
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
      /** Prazo obrigatório (Fase 2): não existe QR sem prazo. */
      ttlSeconds: number;
      /** Modo telão: renova sozinho a cada prazo. */
      rotating: boolean;
      validFrom?: Date | null;
    },
    actor: StaffActor,
  ): Promise<string> {
    QrCode.assertValidTtl(input.ttlSeconds);
    const { challenges, qrCodes, random, audit, clock, uow } = this.deps;
    const now = clock.now();
    const validFrom = input.validFrom ?? null;
    // Fixo: vale do início (ou de agora) até o prazo. Telão: o prazo é de cada código.
    const validUntil = input.rotating
      ? null
      : new Date((validFrom ?? now).getTime() + input.ttlSeconds * 1000);

    return uow.run(async () => {
      const challenge = await challenges.findById(input.challengeId);
      if (!challenge) throw new NotFoundError(CHALLENGE_NOT_FOUND);
      // Lojista só gera QR de desafio da própria loja.
      assertStoreAccess(actor, challenge.toState().storeId);
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
              ttlSeconds: input.ttlSeconds,
              rotating: input.rotating,
              rotationSecret: input.rotating ? random.token(TOKEN_BYTES) : null,
              createdBy: actor.id,
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
