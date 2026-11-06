import { isMerchantRoleName } from "@arp/contracts";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { PasswordHasher } from "../../../shared/application/ports/password-hasher";
import type { SecureRandom } from "../../../shared/application/ports/secure-random";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { ValidationError } from "../../../shared/domain/errors";
import type { RoleRepository, StoreExistence, UserRepository } from "../domain/repositories";
import type { Role } from "../domain/role";
import type { User } from "../domain/user";
import type { SessionService } from "./session-service";

export interface UserUseCaseDeps {
  users: UserRepository;
  roles: RoleRepository;
  stores: StoreExistence;
  hasher: PasswordHasher;
  random: SecureRandom;
  sessions: SessionService;
  audit: AuditLogger;
  uow: UnitOfWork;
}

export const USER_NOT_FOUND = "Usuário não encontrado";

export async function requireRole(roles: RoleRepository, roleId: string): Promise<Role> {
  const role = await roles.findById(roleId);
  if (!role) throw ValidationError.field("roleId", "Cargo não encontrado");
  return role;
}

export async function requireStore(stores: StoreExistence, storeId: string | null | undefined) {
  if (storeId && !(await stores.exists(storeId))) {
    throw ValidationError.field("storeId", "Loja não encontrada");
  }
}

/** Lojista sem loja não enxerga nada: o cargo de lojista exige a loja. */
export function requireStoreForRole(role: Role, storeId: string | null | undefined) {
  if (isMerchantRoleName(role.name) && !storeId) {
    throw ValidationError.field("storeId", "Escolha a loja deste lojista");
  }
}

export function auditState(user: User) {
  const { passwordHash: _omit, ...rest } = user.toState();
  return rest;
}
