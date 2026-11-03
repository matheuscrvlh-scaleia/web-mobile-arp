import { ConflictError } from "../../../shared/domain/errors";
import { applyPatch } from "../../../shared/domain/patch";

export type ChallengeValidation = "qr" | "auto";
export type ChallengeStatus = "active" | "inactive";

export interface ChallengeProps {
  id: string;
  campaignId: string;
  sealId: string;
  title: string;
  howTo: string;
  icon: string;
  validation: ChallengeValidation;
  storeId: string | null;
  /** Produto do parceiro (desafio de produto). */
  product: string | null;
  eventId: string | null;
  sortOrder: number;
  status: ChallengeStatus;
}

export type NewChallenge = Omit<ChallengeProps, "id">;
export type ChallengeChanges = Partial<Omit<ChallengeProps, "id" | "campaignId">>;

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

  /** Aceita leitura de QR: ativo e validado por QR. */
  get acceptsQr(): boolean {
    return this.props.status === "active" && this.props.validation === "qr";
  }

  update(changes: ChallengeChanges): void {
    this.props = applyPatch(this.props, changes);
  }

  /** Quem já ganhou o selo deste desafio mantém o histórico: não dá para apagar. */
  assertDeletable(earnedCount: number): void {
    if (earnedCount > 0) {
      throw new ConflictError(
        `Este desafio já deu ${earnedCount} selo(s). Desative em vez de apagar.`,
      );
    }
  }

  toState(): ChallengeProps {
    return { ...this.props };
  }
}
