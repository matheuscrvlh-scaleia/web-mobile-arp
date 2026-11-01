import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import type { RoleChanges } from "../domain/role";
import { ROLE_NOT_FOUND, type RoleUseCaseDeps } from "./role-deps";

export class UpdateRoleUseCase {
  constructor(private readonly deps: RoleUseCaseDeps) {}

  async execute(input: { id: string; changes: RoleChanges }, actor: StaffActor): Promise<void> {
    await this.deps.uow.run(async () => {
      const role = await this.deps.roles.findById(input.id);
      if (!role) throw new NotFoundError(ROLE_NOT_FOUND);
      const before = role.toState();
      role.update(input.changes);
      const changes = diff(before, role.toState());
      if (!hasChanges(changes)) return;
      await this.deps.roles.save(role);
      await this.deps.audit.log({
        actor,
        action: "role.update",
        entityType: "role",
        entityId: role.id,
        changes,
      });
    });
  }
}
