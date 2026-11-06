import type { RequestOrigin } from "../../../shared/application/actor";
import type { Clock } from "../../../shared/application/ports/clock";
import type { OpaqueTokenGenerator } from "../../../shared/application/ports/token-service";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { UnauthenticatedError } from "../../../shared/domain/errors";
import type { SessionRepository } from "../domain/repositories";
import type { Session, SessionAudience } from "../domain/session";

export interface IssuedRefresh {
  refreshToken: string;
  expiresAt: Date;
  sessionId: string;
  familyId: string;
}

export interface RotatedRefresh extends IssuedRefresh {
  subjectId: string;
}

export interface SessionServiceDeps {
  sessions: SessionRepository;
  opaqueTokens: OpaqueTokenGenerator;
  clock: Clock;
  uow: UnitOfWork;
  ttlDays: Record<SessionAudience, number>;
  /** Tolerância de reuso logo após a troca (ms). 0 = qualquer reuso derruba a família. */
  reuseGraceMs?: number;
}

const DAY_MS = 86_400_000;
const SESSION_ENDED = "Sua sessão terminou. Entre de novo.";

/**
 * Refresh tokens opacos e rotativos do painel e do app (mesmo mecanismo,
 * audiências separadas). Usado pelos casos de uso de login/refresh/logout.
 */
export class SessionService {
  constructor(private readonly deps: SessionServiceDeps) {}

  /** Abre uma família nova (login). Chame dentro da transação do login. */
  async start(
    audience: SessionAudience,
    subjectId: string,
    origin: RequestOrigin,
  ): Promise<IssuedRefresh> {
    return this.issue(audience, subjectId, null, origin);
  }

  /**
   * Troca o refresh por um novo da mesma família. Token desconhecido,
   * vencido ou revogado → 401. Token já rotacionado (reuso) → revoga a
   * família inteira (gravado mesmo com o 401) e 401.
   *
   * Tolerância: reapresentar o token anterior até `reuseGraceMs` depois da
   * troca, enquanto o sucessor ainda não foi usado, emite outro token na
   * mesma família (a resposta da troca se perdeu, ou duas requisições
   * renovaram juntas). O primeiro irmão a ser usado revoga os outros: a
   * família volta a ter um único token vivo.
   */
  async rotate(
    audience: SessionAudience,
    refreshToken: string,
    origin: RequestOrigin,
  ): Promise<RotatedRefresh> {
    const tokenHash = this.deps.opaqueTokens.hash(refreshToken);
    const result = await this.deps.uow.run(async () => {
      const session = await this.deps.sessions.findByTokenHashForUpdate(tokenHash);
      if (!session || session.audience !== audience) return null;
      const now = this.deps.clock.now();
      const check = session.check(now, this.deps.reuseGraceMs ?? 0);
      if (check === "recently-rotated" && (await this.successorUnused(session, now))) {
        const sibling = await this.issue(audience, session.subjectId, session.familyId, origin);
        return { ...sibling, subjectId: session.subjectId };
      }
      if (check === "reused" || check === "recently-rotated") {
        // Quem apresentou um token antigo pode ser o ladrão ou a vítima: derruba os dois.
        await this.deps.sessions.revokeFamily(session.familyId, now);
        return null;
      }
      if (check !== "ok") return null;

      const next = await this.issue(audience, session.subjectId, session.familyId, origin);
      await this.deps.sessions.markRotated(session.id, next.sessionId, now);
      // Irmãos emitidos pela tolerância perdem a validade: este foi o escolhido.
      await this.deps.sessions.revokeFamily(session.familyId, now, next.sessionId);
      return { ...next, subjectId: session.subjectId };
    });
    // Fora da transação: a revogação da família já foi gravada.
    if (!result) throw new UnauthenticatedError(SESSION_ENDED);
    return result;
  }

  /** Dono do refresh token, mesmo revogado ou vencido (para explicar por que caiu). */
  async subjectOf(audience: SessionAudience, refreshToken: string): Promise<string | null> {
    const tokenHash = this.deps.opaqueTokens.hash(refreshToken);
    return this.deps.uow.run(async () => {
      const session = await this.deps.sessions.findByTokenHashForUpdate(tokenHash);
      return session && session.audience === audience ? session.subjectId : null;
    });
  }

  /** Logout: revoga a sessão do token (se existir). Idempotente. */
  async end(refreshToken: string): Promise<{ subjectId: string } | null> {
    const tokenHash = this.deps.opaqueTokens.hash(refreshToken);
    return this.deps.uow.run(async () => {
      const session = await this.deps.sessions.findByTokenHashForUpdate(tokenHash);
      if (!session) return null;
      await this.deps.sessions.revokeFamily(session.familyId, this.deps.clock.now());
      return { subjectId: session.subjectId };
    });
  }

  /** Derruba todos os logins do usuário/visitante (ex.: desativado, bloqueado, nova senha). */
  async endAllFor(
    subjectId: string,
    audience: SessionAudience,
    exceptFamilyId?: string,
  ): Promise<void> {
    await this.deps.sessions.revokeAllForSubject(
      subjectId,
      audience,
      this.deps.clock.now(),
      exceptFamilyId,
    );
  }

  /** O token que substituiu este ainda não foi usado nem revogado. */
  private async successorUnused(session: Session, now: Date): Promise<boolean> {
    if (!session.replacedById) return false;
    const successor = await this.deps.sessions.findByIdForUpdate(session.replacedById);
    return successor?.check(now) === "ok";
  }

  private async issue(
    audience: SessionAudience,
    subjectId: string,
    familyId: string | null,
    origin: RequestOrigin,
  ): Promise<IssuedRefresh> {
    const { token, hash } = this.deps.opaqueTokens.generate();
    const expiresAt = new Date(
      this.deps.clock.now().getTime() + this.deps.ttlDays[audience] * DAY_MS,
    );
    const session = await this.deps.sessions.create({
      audience,
      subjectId,
      familyId,
      tokenHash: hash,
      expiresAt,
      userAgent: origin.userAgent,
      ip: origin.ip,
    });
    return { refreshToken: token, expiresAt, sessionId: session.id, familyId: session.familyId };
  }
}
