import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { Clock } from "../../../shared/application/ports/clock";
import type { SecureRandom } from "../../../shared/application/ports/secure-random";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { ValidationError } from "../../../shared/domain/errors";
import type {
  CampaignRepository,
  ChallengeReferences,
  ChallengeRepository,
  QrCodeRepository,
  SealAwardRepository,
  SealRepository,
} from "../domain/repositories";

export interface GamificationDeps {
  seals: SealRepository;
  campaigns: CampaignRepository;
  challenges: ChallengeRepository;
  qrCodes: QrCodeRepository;
  awards: SealAwardRepository;
  references: ChallengeReferences;
  random: SecureRandom;
  audit: AuditLogger;
  clock: Clock;
  uow: UnitOfWork;
}

export const SEAL_NOT_FOUND = "Selo não encontrado";
export const CAMPAIGN_NOT_FOUND = "Campanha não encontrada";
export const CHALLENGE_NOT_FOUND = "Desafio não encontrado";
export const QR_CODE_NOT_FOUND = "QR Code não encontrado";

/** Loja e evento opcionais de um desafio precisam existir. */
export async function assertChallengeReferences(
  deps: Pick<GamificationDeps, "seals" | "references">,
  refs: { sealId?: string; storeId?: string | null; eventId?: string | null },
): Promise<void> {
  if (refs.sealId && !(await deps.seals.findById(refs.sealId))) {
    throw ValidationError.field("sealId", SEAL_NOT_FOUND);
  }
  if (refs.storeId && !(await deps.references.storeExists(refs.storeId))) {
    throw ValidationError.field("storeId", "Loja não encontrada");
  }
  if (refs.eventId && !(await deps.references.eventExists(refs.eventId))) {
    throw ValidationError.field("eventId", "Evento não encontrado");
  }
}

/** Loja do cupom do gatilho (ValidationError se o cupom não existe; null sem cupom). */
export async function couponStoreOf(
  deps: Pick<GamificationDeps, "references">,
  couponId: string | null,
): Promise<string | null> {
  if (!couponId) return null;
  const storeId = await deps.references.couponStoreId(couponId);
  if (!storeId) throw ValidationError.field("couponId", "Cupom não encontrado");
  return storeId;
}
