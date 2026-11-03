import type { NewRole, Role } from "./role";
import type { Session, SessionAudience } from "./session";
import type { NewUser, User } from "./user";

export interface RoleRepository {
  findById(id: string): Promise<Role | null>;
  /** ConflictError se o nome já existir. */
  create(data: NewRole): Promise<Role>;
  save(role: Role): Promise<void>;
  delete(id: string): Promise<void>;
  countUsers(roleId: string): Promise<number>;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /** ConflictError se o e-mail já existir. */
  create(data: NewUser): Promise<User>;
  save(user: User): Promise<void>;
  recordLogin(id: string, at: Date): Promise<void>;
  /** ConflictError se algo ainda aponta para o usuário (cupons, notificações...). */
  delete(id: string): Promise<void>;
  /** Administradores ativos (cargo do sistema), sem contar o usuário informado. */
  countOtherActiveAdmins(excludeUserId: string): Promise<number>;
}

/** Perfil mínimo para emitir o access token do painel (cargo e loja atuais). */
export interface StaffProfile {
  id: string;
  name: string;
  status: "active" | "disabled";
  roleId: string;
  permissions: string[];
  storeId: string | null;
}

export interface StaffProfileReader {
  findProfile(userId: string): Promise<StaffProfile | null>;
}

export interface NewSession {
  audience: SessionAudience;
  subjectId: string;
  /** null = família nova (o id da sessão vira o id da família). */
  familyId: string | null;
  tokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
  ip: string | null;
}

export interface SessionRepository {
  create(data: NewSession): Promise<Session>;
  /** Com trava de linha (FOR UPDATE): serializa refresh simultâneos do mesmo token. */
  findByTokenHashForUpdate(tokenHash: string): Promise<Session | null>;
  findByIdForUpdate(id: string): Promise<Session | null>;
  markRotated(id: string, replacedById: string, at: Date): Promise<void>;
  revoke(id: string, at: Date): Promise<void>;
  /** Revoga as sessões vivas da família, menos `exceptId` (se informado). */
  revokeFamily(familyId: string, at: Date, exceptId?: string): Promise<number>;
  revokeAllForSubject(
    subjectId: string,
    audience: SessionAudience,
    at: Date,
    exceptFamilyId?: string,
  ): Promise<number>;
  /** Apaga sessões vencidas há mais de `olderThan` (em lote). */
  deleteExpired(olderThan: Date, limit: number): Promise<number>;
  /**
   * Apaga sessões já rotacionadas criadas antes de `olderThan` (em lote). Cada
   * refresh do app grava uma linha nova; sem isto a tabela guarda 90 dias de
   * rotações por aparelho. Reuso de um token tão antigo vira 401 simples (sem
   * revogar a família) — o token já não vale de qualquer jeito.
   */
  deleteRotated(olderThan: Date, limit: number): Promise<number>;
}

/** Existência de loja, sem depender do módulo directory. */
export interface StoreExistence {
  exists(storeId: string): Promise<boolean>;
}
