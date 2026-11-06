import type { Campaign, NewCampaign, TierInput } from "./campaign";
import type { Challenge, NewChallenge } from "./challenge";
import type { NewQrCode, QrCode } from "./qr-code";
import type { NewSeal, Seal } from "./seal";

export interface SealRepository {
  findById(id: string): Promise<Seal | null>;
  /** Slugs já usados que começam com a base (para gerar um livre). */
  slugsLike(base: string): Promise<Set<string>>;
  /** ConflictError se o slug já existir. */
  create(data: NewSeal): Promise<Seal>;
  save(seal: Seal): Promise<void>;
  /** Uso do selo: conquistas e desafios que o dão (para excluir). */
  usage(id: string): Promise<{ earned: number; challenges: number }>;
  delete(id: string): Promise<void>;
}

export interface CampaignRepository {
  findById(id: string): Promise<Campaign | null>;
  create(data: NewCampaign): Promise<Campaign>;
  save(campaign: Campaign): Promise<void>;
  replaceTiers(campaignId: string, tiers: readonly TierInput[]): Promise<void>;
  tiersOf(campaignId: string): Promise<TierInput[]>;
  /** Selos dados na campanha (com algum, não dá para excluir). */
  countEarned(campaignId: string): Promise<number>;
  /** Exclui a campanha com desafios, QR Codes e faixas (só sem selos dados). */
  delete(campaignId: string): Promise<void>;
}

export interface ChallengeRepository {
  findById(id: string): Promise<Challenge | null>;
  /** Desafios da campanha, na ordem do app. */
  listByCampaign(campaignId: string): Promise<Challenge[]>;
  create(data: NewChallenge): Promise<Challenge>;
  save(challenge: Challenge): Promise<void>;
  delete(id: string): Promise<void>;
  countEarned(challengeId: string): Promise<number>;
  /** Ordem para um desafio novo entrar no fim da campanha. */
  nextSortOrder(campaignId: string): Promise<number>;
  /** Ids dos desafios da campanha, travados para reordenar. */
  lockCampaignIds(campaignId: string): Promise<string[]>;
  /** sort_order = posição na lista (0, 1, 2…). */
  applyOrder(ids: readonly string[]): Promise<void>;
}

export interface QrCodeRepository {
  findById(id: string): Promise<QrCode | null>;
  /** QrTokenCollisionError se o token já existir. */
  create(data: NewQrCode): Promise<QrCode>;
  save(qr: QrCode): Promise<void>;
}

/** Existência de loja e evento referenciados por um desafio (outros módulos). */
export interface ChallengeReferences {
  storeExists(id: string): Promise<boolean>;
  eventExists(id: string): Promise<boolean>;
  /** Loja do cupom (null = cupom não existe). */
  couponStoreId(id: string): Promise<string | null>;
}

export type ScanResult = "awarded" | "duplicate" | "expired" | "invalid";

/** Desafio automático disparado pela baixa de um cupom (com campanha e selo). */
export type CouponChallengeContext = Omit<QrScanContext, "qr"> & { sealName: string };

/** Tudo o que a leitura de um QR precisa, numa consulta. */
export interface QrScanContext {
  qr: QrCode;
  challenge: Challenge;
  campaign: Campaign;
  seal: {
    points: number;
    validityMonths: number;
    repeatable: boolean;
    availableFrom: Date | null;
    availableUntil: Date | null;
  };
}

export interface SealAward {
  visitorId: string;
  challengeId: string;
  sealId: string;
  campaignId: string;
  qrCodeId: string | null;
  earnedAt: Date;
  points: number;
  expiresAt: Date;
  repeatable: boolean;
  /** Janela do telão (0 no QR fixo). */
  qrWindow: number;
}

export interface SealAwardRepository {
  findQrContext(token: string): Promise<QrScanContext | null>;
  /** Desafios automáticos ligados à baixa deste cupom (ativos ou não; quem decide é o domínio). */
  findCouponChallenges(couponId: string): Promise<CouponChallengeContext[]>;
  hasEarned(
    visitorId: string,
    challengeId: string,
    repeat?: { qrCodeId: string; qrWindow: number },
  ): Promise<boolean>;
  totalPoints(visitorId: string, now: Date): Promise<number>;
  /** SealAlreadyEarnedError se o visitante já tiver o selo do desafio (corrida). */
  award(data: SealAward): Promise<string>;
  recordScan(scan: {
    qrCodeId: string | null;
    visitorId: string;
    result: ScanResult;
    at: Date;
  }): Promise<void>;
}
