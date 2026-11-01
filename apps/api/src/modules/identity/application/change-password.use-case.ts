import type { StaffActor } from "../../../shared/application/actor";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { PasswordHasher } from "../../../shared/application/ports/password-hasher";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { NotFoundError, ValidationError } from "../../../shared/domain/errors";
import type { UserRepository } from "../domain/repositories";
import type { SessionService } from "./session-service";
import { USER_NOT_FOUND } from "./user-rules";

export interface ChangePasswordDeps {
  users: UserRepository;
  hasher: PasswordHasher;
  sessions: SessionService;
  audit: AuditLogger;
  uow: UnitOfWork;
}

/** Troca a própria senha e derruba os outros logins (mantém o atual). */
export class ChangePasswordUseCase {
  constructor(private readonly deps: ChangePasswordDeps) {}

  async execute(
    input: { currentPassword: string; newPassword: string },
    actor: StaffActor,
  ): Promise<void> {
    const { users, hasher, sessions, audit, uow } = this.deps;
    const user = await users.findById(actor.id);
    if (!user) throw new NotFoundError(USER_NOT_FOUND);
    if (!(await hasher.verify(user.passwordHash, input.currentPassword))) {
      throw ValidationError.field("currentPassword", "Senha atual incorreta");
    }
    user.changePassword(await hasher.hash(input.newPassword));

    await uow.run(async () => {
      await users.save(user);
      await sessions.endAllFor(user.id, "admin", actor.sessionId);
      await audit.log({
        actor,
        action: "user.change_password",
        entityType: "user",
        entityId: user.id,
      });
    });
  }
}
