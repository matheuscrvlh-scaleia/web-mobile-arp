export type SessionAudience = "admin" | "app";

export interface SessionProps {
  id: string;
  audience: SessionAudience;
  subjectId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  /** Momento da troca (rotação) deste token. */
  lastUsedAt: Date | null;
}

/**
 * Resultado de apresentar um refresh token. "recently-rotated": já foi
 * trocado, mas dentro da tolerância (resposta perdida ou requisições
 * simultâneas); o serviço decide se ainda dá para emitir outro.
 */
export type RefreshCheck = "ok" | "recently-rotated" | "reused" | "revoked" | "expired";

/**
 * Sessão de refresh token (rotativo). Cada uso gera uma sessão nova na
 * mesma família; apresentar de novo um token já rotacionado é sinal de
 * roubo (alguém guardou a cópia) e derruba a família inteira.
 */
export class Session {
  private constructor(private readonly props: SessionProps) {}

  static restore(props: SessionProps): Session {
    return new Session({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get audience(): SessionAudience {
    return this.props.audience;
  }
  get subjectId(): string {
    return this.props.subjectId;
  }
  get familyId(): string {
    return this.props.familyId;
  }

  get replacedById(): string | null {
    return this.props.replacedById;
  }

  check(now: Date, reuseGraceMs = 0): RefreshCheck {
    if (this.props.replacedById !== null) {
      const rotatedAt = this.props.lastUsedAt?.getTime();
      return rotatedAt !== undefined && now.getTime() - rotatedAt < reuseGraceMs
        ? "recently-rotated"
        : "reused";
    }
    if (this.props.revokedAt !== null) return "revoked";
    if (this.props.expiresAt <= now) return "expired";
    return "ok";
  }
}
