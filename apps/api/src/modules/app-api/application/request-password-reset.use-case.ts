import type { Clock } from "../../../shared/application/ports/clock";
import type { Mailer } from "../../../shared/application/ports/mailer";
import type { SecureRandom } from "../../../shared/application/ports/secure-random";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { ServiceUnavailableError } from "../../../shared/domain/errors";
import type { PasswordResetRepository, VisitorAccountRepository } from "../domain/repositories";
import {
  passwordResetEmail,
  RESET_CODE_LENGTH,
  RESET_UNAVAILABLE_MESSAGE,
  type ResetCodeHasher,
} from "./password-reset";

interface ErrorLogger {
  error(obj: object, msg?: string): void;
}

export interface RequestPasswordResetDeps {
  visitors: Pick<VisitorAccountRepository, "findByEmail">;
  resets: PasswordResetRepository;
  codes: ResetCodeHasher;
  random: SecureRandom;
  /** null = sem envio de e-mail configurado (produção sem MAIL_DRIVER). */
  mailer: Mailer | null;
  clock: Clock;
  uow: UnitOfWork;
  ttlMinutes: number;
  logger: ErrorLogger;
}

/**
 * "Esqueci a senha": manda um código de 6 dígitos para contas por senha e
 * ativas. Para quem chama, a resposta é sempre a mesma (não revela se o
 * e-mail tem conta). Pedido novo invalida os códigos anteriores.
 */
export class RequestPasswordResetUseCase {
  constructor(private readonly deps: RequestPasswordResetDeps) {}

  async execute(input: { email: string }): Promise<void> {
    const { visitors, resets, codes, random, mailer, clock, uow, ttlMinutes, logger } = this.deps;
    // Antes de olhar o e-mail: indisponível é igual para todo mundo.
    if (!mailer) throw new ServiceUnavailableError(RESET_UNAVAILABLE_MESSAGE);

    const visitor = await visitors.findByEmail(input.email);
    if (!visitor?.passwordHash || !visitor.isActive) return;

    const code = random.string("0123456789", RESET_CODE_LENGTH);
    const expiresAt = new Date(clock.now().getTime() + ttlMinutes * 60_000);
    await uow.run(() => resets.replace(visitor.id, codes.hash(visitor.id, code), expiresAt));

    try {
      await mailer.send(
        passwordResetEmail({ to: visitor.email, name: visitor.name, code, ttlMinutes }),
      );
    } catch (err) {
      // Falha de envio não muda a resposta (senão revelaria que a conta existe).
      logger.error({ err, visitorId: visitor.id }, "Falha ao enviar o código de nova senha");
    }
  }
}
