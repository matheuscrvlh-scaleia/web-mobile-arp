import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import { ROLE_NOT_FOUND, type RoleUseCaseDeps } from "./role-deps";

export class DeleteRoleUseCase {
  constructor(private readonly deps: RoleUseCaseDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    await this.deps.uow.run(async () => {
      const role = await this.deps.roles.findById(input.id);
      if (!role) throw new NotFoundError(ROLE_NOT_FOUND);
      role.assertDeletable(await this.deps.roles.countUsers(role.id));
      await this.deps.roles.delete(role.id);
      await this.deps.audit.log({
        actor,
        action: "role.delete",
        entityType: "role",
        entityId: role.id,
        changes: snapshot(role.toState()),
      });
    });
  }
}
