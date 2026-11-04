import { ConflictError, ValidationError } from "../../../shared/domain/errors";
import { applyPatch } from "../../../shared/domain/patch";

export type ChallengeValidation = "qr" | "auto";
export type ChallengeStatus = "active" | "inactive";
/** O que dá o selo num desafio automático. */
export type ChallengeAutoTrigger = "coupon_redeemed" | "integration";

export interface ChallengeProps {
  id: string;
  campaignId: string;
  sealId: string;
  title: string;
  howTo: string;
  icon: string;
  validation: ChallengeValidation;
  /** Só no automático: baixa de cupom no caixa ou sistema externo. */
  autoTrigger: ChallengeAutoTrigger | null;
  /** Cupom cuja baixa dá o selo (gatilho coupon_redeemed). */
  couponId: string | null;
  storeId: string | null;
  /** Produto do parceiro (desafio de produto). */
  product: string | null;
  eventId: string | null;
  sortOrder: number;
  status: ChallengeStatus;
}

export type NewChallenge = Omit<ChallengeProps, "id">;
export type ChallengeChanges = Partial<Omit<ChallengeProps, "id" | "campaignId">>;

/**
 * Gatilho e cupom coerentes com a validação: no QR somem; o automático
 * exige gatilho e o gatilho de cupom exige o cupom. Mesmas regras do banco.
 */
export function normalizeChallengeTrigger<
  T extends Pick<ChallengeProps, "validation" | "autoTrigger" | "couponId">,
>(p: T): T {
  const autoTrigger = p.validation === "auto" ? p.autoTrigger : null;
  const couponId = autoTrigger === "coupon_redeemed" ? p.couponId : null;
  if (p.validation === "auto" && !autoTrigger) {
    throw ValidationError.field("autoTrigger", "Escolha o que dá o selo automático");
  }
  if (autoTrigger === "coupon_redeemed" && !couponId) {
    throw ValidationError.field("couponId", "Escolha o cupom que dá o selo");
  }
  return { ...p, autoTrigger, couponId };
}

/** Desafio de uma campanha: cumprir dá um selo, uma vez por pessoa. */
export class Challenge {
  private constructor(private props: ChallengeProps) {}

  static restore(props: ChallengeProps): Challenge {
    return new Challenge({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get campaignId(): string {
    return this.props.campaignId;
  }
  get sealId(): string {
    return this.props.sealId;
  }
  get couponId(): string | null {
    return this.props.couponId;
  }

  /** Aceita leitura de QR: ativo e validado por QR. */
  get acceptsQr(): boolean {
    return this.props.status === "active" && this.props.validation === "qr";
  }

  /** Dá o selo na baixa deste cupom: ativo, automático e com gatilho de cupom. */
  firesOnRedeemOf(couponId: string): boolean {
    return (
      this.props.status === "active" &&
      this.props.validation === "auto" &&
      this.props.autoTrigger === "coupon_redeemed" &&
      this.props.couponId === couponId
    );
  }

  update(changes: ChallengeChanges): void {
    this.props = normalizeChallengeTrigger(applyPatch(this.props, changes));
  }

  /**
   * Travas para apagar: quem já ganhou o selo mantém o histórico (não dá
   * para apagar) e desafio ativo precisa sair do app antes (desativar).
   */
  assertDeletable(earnedCount: number): void {
    if (earnedCount > 0) {
      throw new ConflictError(
        `Este desafio já deu ${earnedCount} selo(s). Desative em vez de apagar.`,
      );
    }
    if (this.props.status === "active") {
      throw new ConflictError("Desative o desafio antes de apagar.");
    }
  }

  toState(): ChallengeProps {
    return { ...this.props };
  }
}
