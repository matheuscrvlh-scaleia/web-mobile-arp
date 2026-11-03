import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { BusinessRuleError, NotFoundError } from "../../../shared/domain/errors";
import { auditState, requireRole, USER_NOT_FOUND, type UserUseCaseDeps } from "./user-rules";

/**
 * Exclui de vez quem ainda não deixou registro no sistema. Com histórico
 * (cupons, notificações...) o banco recusa e o caminho é desativar.
 */
export class DeleteUserUseCase {
  constructor(private readonly deps: UserUseCaseDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    const { users, roles, sessions, audit, uow } = this.deps;
    if (input.id === actor.id) throw new BusinessRuleError("Você não pode excluir a própria conta");
    await uow.run(async () => {
      const user = await users.findById(input.id);
      if (!user) throw new NotFoundError(USER_NOT_FOUND);
      const role = await requireRole(roles, user.roleId);
      if (user.isActive && role.isSystem && (await users.countOtherActiveAdmins(user.id)) === 0) {
        throw new BusinessRuleError("Não é possível excluir o último administrador");
      }
      await sessions.endAllFor(user.id, "admin");
      await users.delete(user.id);
      await audit.log({
        actor,
        action: "user.delete",
        entityType: "user",
        entityId: user.id,
        changes: snapshot(auditState(user)),
      });
    });
  }
}
