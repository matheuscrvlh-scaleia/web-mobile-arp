import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { BusinessRuleError, NotFoundError } from "../../../shared/domain/errors";
import type { UserChanges } from "../domain/user";
import {
  auditState,
  requireRole,
  requireStore,
  USER_NOT_FOUND,
  type UserUseCaseDeps,
} from "./user-rules";

export class UpdateUserUseCase {
  constructor(private readonly deps: UserUseCaseDeps) {}

  async execute(input: { id: string; changes: UserChanges }, actor: StaffActor): Promise<void> {
    const { users, roles, stores, sessions, audit, uow } = this.deps;
    await uow.run(async () => {
      const user = await users.findById(input.id);
      if (!user) throw new NotFoundError(USER_NOT_FOUND);
      const { changes } = input;
      if (changes.status === "disabled" && user.id === actor.id) {
        throw new BusinessRuleError("Você não pode desativar a própria conta");
      }
      const currentRole = await requireRole(roles, user.roleId);
      const nextRole =
        changes.roleId && changes.roleId !== user.roleId
          ? await requireRole(roles, changes.roleId)
          : currentRole;
      if (changes.storeId !== undefined) await requireStore(stores, changes.storeId);

      const before = auditState(user);
      const wasAdmin = user.isActive && currentRole.isSystem;
      user.update(changes);
      const isAdmin = user.isActive && nextRole.isSystem;
      if (wasAdmin && !isAdmin && (await users.countOtherActiveAdmins(user.id)) === 0) {
        throw new BusinessRuleError("Não é possível desativar ou rebaixar o último administrador");
      }

      const changed = diff(before, auditState(user));
      if (!hasChanges(changed)) return;
      await users.save(user);
      // Desativado sai na hora do refresh; troca de cargo/loja vale no próximo refresh.
      if (!user.isActive) await sessions.endAllFor(user.id, "admin");
      await audit.log({
        actor,
        action: "user.update",
        entityType: "user",
        entityId: user.id,
        changes: changed,
      });
    });
  }
}
