import { applyPatch } from "../../../shared/domain/patch";
export type UserStatus = "active" | "disabled";

export interface UserProps {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  roleId: string;
  storeId: string | null;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
}

export type NewUser = Omit<UserProps, "id" | "lastLoginAt">;
export type UserChanges = Partial<
  Pick<UserProps, "name" | "email" | "roleId" | "storeId" | "status">
>;

/** Usuário do painel. */
export class User {
  private constructor(private props: UserProps) {}

  static restore(props: UserProps): User {
    return new User({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get email(): string {
    return this.props.email;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get roleId(): string {
    return this.props.roleId;
  }
  get storeId(): string | null {
    return this.props.storeId;
  }
  get status(): UserStatus {
    return this.props.status;
  }
  get isActive(): boolean {
    return this.props.status === "active";
  }

  update(changes: UserChanges): void {
    this.props = applyPatch(this.props, changes);
  }

  /** Troca feita pelo próprio usuário: deixa de ser provisória. */
  changePassword(passwordHash: string): void {
    this.props = { ...this.props, passwordHash, mustChangePassword: false };
  }

  /** Senha provisória gerada pelo admin: obriga a trocar no próximo acesso. */
  resetPassword(passwordHash: string): void {
    this.props = { ...this.props, passwordHash, mustChangePassword: true };
  }

  toState(): UserProps {
    return { ...this.props };
  }
}
