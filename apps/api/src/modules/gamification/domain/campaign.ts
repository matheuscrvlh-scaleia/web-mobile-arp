import { ValidationError } from "../../../shared/domain/errors";
import { applyPatch } from "../../../shared/domain/patch";
import { type Phase, phaseOf } from "../../../shared/domain/time";

export type CampaignStatus = "draft" | "published" | "archived";

export interface CampaignProps {
  id: string;
  name: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  status: CampaignStatus;
}

export type NewCampaign = Omit<CampaignProps, "id">;
export type CampaignChanges = Partial<Omit<CampaignProps, "id">>;

export interface TierInput {
  threshold: number;
  label: string;
  icon: string;
}

/** Campanha mensal de desafios (ex.: "Desafios de outubro"). */
export class Campaign {
  private constructor(private props: CampaignProps) {}

  static restore(props: CampaignProps): Campaign {
    return new Campaign({ ...props });
  }

  static assertValidNew(data: NewCampaign): void {
    assertPeriod(data.startsAt, data.endsAt);
  }

  /** Faixas: limiares únicos (o contrato já confere; aqui vale para qualquer origem). */
  static assertValidTiers(tiers: readonly TierInput[]): void {
    if (new Set(tiers.map((t) => t.threshold)).size !== tiers.length) {
      throw ValidationError.field("tiers", "Faixa repetida");
    }
  }

  get id(): string {
    return this.props.id;
  }
  get status(): CampaignStatus {
    return this.props.status;
  }

  /** Em relação a um instante (início inclusivo, fim exclusivo). */
  phaseAt(now: Date): Phase {
    return phaseOf(now, this.props.startsAt, this.props.endsAt);
  }

  /** QR Codes só dão selo com a campanha publicada e no ar. */
  isLiveAt(now: Date): boolean {
    return this.props.status === "published" && this.phaseAt(now) === "live";
  }

  update(changes: CampaignChanges): void {
    const next = applyPatch(this.props, changes);
    assertPeriod(next.startsAt, next.endsAt);
    this.props = next;
  }

  toState(): CampaignProps {
    return { ...this.props };
  }
}

function assertPeriod(startsAt: Date, endsAt: Date): void {
  if (endsAt <= startsAt) {
    throw ValidationError.field("endsAt", "O fim precisa ser depois do início");
  }
}
