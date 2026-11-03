import type { StaffActor } from "../../../shared/application/actor";
import { NotFoundError } from "../../../shared/domain/errors";
import { generateTemporaryPassword } from "./temporary-password";
import { USER_NOT_FOUND, type UserUseCaseDeps } from "./user-rules";

export class ResetUserPasswordUseCase {
  constructor(private readonly deps: UserUseCaseDeps) {}

  /** Sem `password`, gera uma; com ela, usa a escolhida. As duas são provisórias. */
  async execute(
    input: { id: string; password?: string },
    actor: StaffActor,
  ): Promise<{ temporaryPassword: string }> {
    const { users, hasher, random, sessions, audit, uow } = this.deps;
    const temporaryPassword = input.password ?? generateTemporaryPassword(random);
    const passwordHash = await hasher.hash(temporaryPassword);
    await uow.run(async () => {
      const user = await users.findById(input.id);
      if (!user) throw new NotFoundError(USER_NOT_FOUND);
      user.resetPassword(passwordHash);
      await users.save(user);
      await sessions.endAllFor(user.id, "admin");
      await audit.log({
        actor,
        action: "user.reset_password",
        entityType: "user",
        entityId: user.id,
      });
    });
    return { temporaryPassword };
  }
}
