import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { generateTemporaryPassword } from "./temporary-password";
import { auditState, requireRole, requireStore, type UserUseCaseDeps } from "./user-rules";

export class CreateUserUseCase {
  constructor(private readonly deps: UserUseCaseDeps) {}

  async execute(
    input: {
      name: string;
      email: string;
      roleId: string;
      storeId?: string | null;
      password?: string;
    },
    actor: StaffActor,
  ): Promise<{ userId: string; temporaryPassword: string | null }> {
    const { users, roles, stores, hasher, random, audit, uow } = this.deps;
    const temporaryPassword = input.password ? null : generateTemporaryPassword(random);
    const passwordHash = await hasher.hash(input.password ?? (temporaryPassword as string));

    return uow.run(async () => {
      await requireRole(roles, input.roleId);
      await requireStore(stores, input.storeId);
      const user = await users.create({
        name: input.name,
        email: input.email,
        passwordHash,
        roleId: input.roleId,
        storeId: input.storeId ?? null,
        status: "active",
        // Senha definida por outra pessoa: o dono troca no primeiro acesso.
        mustChangePassword: true,
      });
      await audit.log({
        actor,
        action: "user.create",
        entityType: "user",
        entityId: user.id,
        changes: snapshot(auditState(user)),
      });
      return { userId: user.id, temporaryPassword };
    });
  }
}
