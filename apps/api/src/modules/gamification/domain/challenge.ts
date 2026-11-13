import { ConflictError, ValidationError } from "../../../shared/domain/errors";
import { applyPatch } from "../../../shared/domain/patch";
import { assertAvailability, isAvailableAt } from "./availability";

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
  /** Janela própria dentro da campanha (null = início/fim da campanha). */
  availableFrom: Date | null;
  availableUntil: Date | null;
  /** Trevos que o selo deste desafio dá (null = os da categoria). */
  points: number | null;
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

  /** Dentro da janela própria (a da campanha é conferida à parte). */
  isAvailableAt(now: Date): boolean {
    return isAvailableAt(this.props, now);
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
    const next = normalizeChallengeTrigger(applyPatch(this.props, changes));
    assertAvailability(next);
    this.props = next;
  }

  /**
   * Trava para excluir: quem já ganhou o selo mantém o histórico. Sem selo
   * dado, sai mesmo ativo (nunca valeu nada para ninguém).
   */
  assertDeletable(earnedCount: number): void {
    if (earnedCount > 0) {
      throw new ConflictError(
        `Este desafio já deu ${earnedCount === 1 ? "1 selo" : `${earnedCount} selos`}: pause em vez de excluir. Quem ganhou mantém o selo.`,
      );
    }
  }

  /**
   * Trocar o selo de um desafio que já deu selos deixaria o histórico com um
   * selo e o desafio com outro: para outro selo, crie outro desafio.
   */
  assertSealChangeAllowed(sealId: string | undefined, earnedCount: number): void {
    if (sealId === undefined || sealId === this.props.sealId || earnedCount === 0) return;
    throw ValidationError.field(
      "sealId",
      "Este desafio já deu selos: quem ganhou ficou com o selo atual. Para outro selo, crie outro desafio.",
    );
  }

  toState(): ChallengeProps {
    return { ...this.props };
  }
}

/** Nova ordem precisa trazer todos os desafios da campanha, cada um uma vez. */
export function assertCompleteChallengeOrder(
  ids: readonly string[],
  existing: readonly string[],
): void {
  const requested = new Set(ids);
  const current = new Set(existing);
  const complete =
    requested.size === ids.length &&
    requested.size === current.size &&
    [...requested].every((id) => current.has(id));
  if (!complete) {
    throw ValidationError.field(
      "ids",
      "A lista de desafios mudou enquanto você arrastava. Recarregue a página e tente de novo.",
    );
  }
}
