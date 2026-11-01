import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import type { RoleRepository } from "../domain/repositories";

export interface RoleUseCaseDeps {
  roles: RoleRepository;
  audit: AuditLogger;
  uow: UnitOfWork;
}

export const ROLE_NOT_FOUND = "Cargo não encontrado";
