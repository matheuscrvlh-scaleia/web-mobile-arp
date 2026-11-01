import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import type { NewRole } from "../domain/role";
import type { RoleUseCaseDeps } from "./role-deps";

export class CreateRoleUseCase {
  constructor(private readonly deps: RoleUseCaseDeps) {}

  async execute(
    input: { name: string; description?: string | null; permissions: string[] },
    actor: StaffActor,
  ): Promise<string> {
    const data: NewRole = {
      name: input.name,
      description: input.description ?? null,
      permissions: [...new Set(input.permissions)],
    };
    return this.deps.uow.run(async () => {
      const role = await this.deps.roles.create(data);
      await this.deps.audit.log({
        actor,
        action: "role.create",
        entityType: "role",
        entityId: role.id,
        changes: snapshot(role.toState()),
      });
      return role.id;
    });
  }
}
