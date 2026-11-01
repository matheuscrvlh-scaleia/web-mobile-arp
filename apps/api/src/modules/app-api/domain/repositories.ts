import type {
  NewSocialVisitorAccount,
  NewVisitorAccount,
  SocialProvider,
  VisitorAccount,
  VisitorProfileChanges,
} from "./visitor-account";

export interface VisitorAccountRepository {
  findById(id: string): Promise<VisitorAccount | null>;
  findByEmail(email: string): Promise<VisitorAccount | null>;
  /** ConflictError se o e-mail já tiver conta. */
  create(data: NewVisitorAccount): Promise<VisitorAccount>;
  touchLastSeen(id: string, at: Date): Promise<void>;
  updateProfile(id: string, changes: VisitorProfileChanges): Promise<void>;
}

/** Credenciais além do cadastro por senha: login social e troca de senha pelo código. */
export interface VisitorCredentialsRepository {
  findByProviderSubject(
    provider: SocialProvider,
    providerSubject: string,
  ): Promise<VisitorAccount | null>;
  /** ConflictError se o e-mail ou o (provedor, sub) já tiver conta. */
  createSocial(data: NewSocialVisitorAccount): Promise<VisitorAccount>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
}

/** Código de recuperação de senha (só o hash fica no banco). */
export interface PasswordReset {
  id: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
}

export interface PasswordResetRepository {
  /** Grava um código novo e apaga os anteriores do visitante (só o último vale). */
  replace(visitorId: string, codeHash: string, expiresAt: Date): Promise<void>;
  /** Último código ainda não usado do visitante, travado para a transação. */
  findPendingForUpdate(visitorId: string): Promise<PasswordReset | null>;
  incrementAttempts(id: string): Promise<void>;
  markUsed(id: string, at: Date): Promise<void>;
  /** Apaga até `limit` códigos vencidos antes de `before` (usados ou não); devolve quantos. */
  deleteStale(before: Date, limit: number): Promise<number>;
}

export type PushPlatform = "ios" | "android";
export type HighlightInteraction = "impression" | "click";

/** Marcações do visitante (idempotentes: marcar duas vezes = uma). */
export interface EngagementRepository {
  isStoreActive(storeId: string): Promise<boolean>;
  isEventPublished(eventId: string): Promise<boolean>;
  setFavorite(visitorId: string, storeId: string, on: boolean): Promise<void>;
  setFollow(visitorId: string, storeId: string, on: boolean): Promise<void>;
  setInterest(visitorId: string, eventId: string, on: boolean): Promise<void>;
  /** Token repetido troca de dono (o aparelho passou para outra conta). */
  upsertPushToken(
    visitorId: string,
    token: string,
    platform: PushPlatform,
    at: Date,
  ): Promise<void>;
  /** Apaga o token; com `visitorId`, só se ainda for dele (pode ter trocado de dono). */
  removePushToken(token: string, visitorId?: string): Promise<void>;
}

/**
 * Contagem de exibições/cliques dos destaques. Acumula e grava em lote
 * (exibição é o evento mais frequente do app: um UPDATE por exibição viraria
 * fila no lock da linha do destaque).
 */
export interface HighlightMetricsRecorder {
  record(highlightId: string, interaction: HighlightInteraction, at: Date): void;
}

/** Destaques no ar agora (leitura curta em cache). */
export interface LiveHighlights {
  isLive(highlightId: string, now: Date): Promise<boolean>;
}
