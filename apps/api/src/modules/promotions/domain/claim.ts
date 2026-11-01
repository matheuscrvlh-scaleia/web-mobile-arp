import {
  ClaimAlreadyRedeemedError,
  ClaimCancelledError,
  ClaimExpiredError,
  ClaimWrongStoreError,
} from "./errors";

export type ClaimStatus = "active" | "redeemed" | "expired" | "cancelled";

export interface ClaimProps {
  id: string;
  couponId: string;
  visitorId: string;
  code: string;
  status: ClaimStatus;
  claimedAt: Date;
  expiresAt: Date;
  redeemedAt: Date | null;
  redeemedBy: string | null;
}

export type NewClaim = Omit<ClaimProps, "id" | "status" | "redeemedAt" | "redeemedBy">;

/** Alfabeto do código: sem 0/O, 1/I/L — ditado no caixa sem confusão. */
export const CLAIM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CLAIM_CODE_LENGTH = 6;

/** Cupom pego por um visitante (código ARP-XXXXXX com prazo de uso). */
export class Claim {
  private constructor(private props: ClaimProps) {}

  static restore(props: ClaimProps): Claim {
    return new Claim({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get code(): string {
    return this.props.code;
  }
  get status(): ClaimStatus {
    return this.props.status;
  }
  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  /** Ativo com prazo vencido já conta como devolvido, antes mesmo do job marcar. */
  isExpiredAt(now: Date): boolean {
    return (
      this.props.status === "expired" ||
      (this.props.status === "active" && this.props.expiresAt <= now)
    );
  }

  /** Uso no caixa por um usuário do painel. */
  redeem(by: string, now: Date): void {
    if (this.props.status === "redeemed") throw new ClaimAlreadyRedeemedError();
    if (this.props.status === "cancelled") throw new ClaimCancelledError();
    if (this.isExpiredAt(now)) throw new ClaimExpiredError();
    this.props = { ...this.props, status: "redeemed", redeemedAt: now, redeemedBy: by };
  }

  toState(): ClaimProps {
    return { ...this.props };
  }
}

/** Lojista só consulta e valida código da própria loja. */
export function assertClaimFromStore(actorStoreId: string | null, claimStoreId: string): void {
  if (actorStoreId && actorStoreId !== claimStoreId) throw new ClaimWrongStoreError();
}
