import { BusinessRuleError, ConflictError } from "../../../shared/domain/errors";

export interface RoleProps {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
}

export type NewRole = Omit<RoleProps, "id" | "isSystem">;
export type RoleChanges = Partial<Pick<RoleProps, "name" | "description" | "permissions">>;

/**
 * Cargo (RBAC). O cargo do sistema (Administrador) é imutável: só a
 * descrição muda; nome e permissões acompanham o catálogo do contrato.
 */
export class Role {
  private constructor(private props: RoleProps) {}

  static restore(props: RoleProps): Role {
    return new Role({ ...props, permissions: [...new Set(props.permissions)] });
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get isSystem(): boolean {
    return this.props.isSystem;
  }
  get permissions(): readonly string[] {
    return this.props.permissions;
  }

  update(changes: RoleChanges): void {
    if (this.props.isSystem) {
      const renames = changes.name !== undefined && changes.name !== this.props.name;
      const repermissions =
        changes.permissions !== undefined && !sameSet(changes.permissions, this.props.permissions);
      if (renames || repermissions) {
        throw new BusinessRuleError(
          "O cargo do sistema não pode ser renomeado nem perder permissões",
        );
      }
    }
    this.props = {
      ...this.props,
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.description !== undefined ? { description: changes.description } : {}),
      ...(changes.permissions !== undefined
        ? { permissions: [...new Set(changes.permissions)] }
        : {}),
    };
  }

  assertDeletable(usersCount: number): void {
    if (this.props.isSystem) throw new BusinessRuleError("O cargo do sistema não pode ser apagado");
    if (usersCount > 0) {
      throw new ConflictError(
        `Este cargo tem ${usersCount} usuário(s). Mude o cargo deles antes de apagar.`,
      );
    }
  }

  toState(): RoleProps {
    return { ...this.props, permissions: [...this.props.permissions] };
  }
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}
