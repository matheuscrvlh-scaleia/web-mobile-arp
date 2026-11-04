import { BusinessRuleError, ValidationError } from "../../../shared/domain/errors";
import { applyPatch } from "../../../shared/domain/patch";

export type CouponStatus = "draft" | "active" | "paused" | "ended";
/** Revisão da ARP: só "approved" aparece no app. */
export type CouponReview = "pending" | "approved" | "rejected";
/** Só verde e off-white (Fase 2). */
export type CouponTone = "green" | "sand";

export interface CouponProps {
  id: string;
  storeId: string;
  title: string;
  headline: string;
  headlineSub: string | null;
  description: string | null;
  scheduleNote: string | null;
  startsAt: Date;
  endsAt: Date | null;
  totalQuantity: number;
  redeemWindowHours: number;
  /** Pego vence no fim da promoção (endsAt), mesmo antes das horas para usar. */
  expiresWithPromotion: boolean;
  tone: CouponTone;
  icon: string;
  imageUrl: string | null;
  savingsCents: number | null;
  status: CouponStatus;
  /** Dias em que pode ser usado (0 = domingo), em ordem. */
  weekdays: number[];
  review: CouponReview;
  reviewNote: string | null;
  createdBy: string | null;
}

export type NewCoupon = Omit<CouponProps, "id">;
export type CouponChanges = Partial<
  Omit<CouponProps, "id" | "storeId" | "status" | "createdBy" | "review" | "reviewNote">
>;

const HOUR_MS = 3_600_000;

/**
 * Transições de status:
 * - draft  → active | ended   (publicar ou desistir)
 * - active → paused | ended   (pausar sem perder o estoque; encerrar)
 * - paused → active | ended
 * - ended  → (final: o histórico dos pegos fica, nada volta a valer)
 * Repetir o status atual não é erro (idempotente).
 */
const TRANSITIONS: Record<CouponStatus, readonly CouponStatus[]> = {
  draft: ["active", "ended"],
  active: ["paused", "ended"],
  paused: ["active", "ended"],
  ended: [],
};

const STATUS_LABEL: Record<CouponStatus, string> = {
  draft: "rascunho",
  active: "ativa",
  paused: "pausada",
  ended: "encerrada",
};

/** Promoção de uma loja, com estoque (totalQuantity) e prazo de uso por pego. */
export class Coupon {
  private constructor(private props: CouponProps) {}

  static restore(props: CouponProps): Coupon {
    return new Coupon({ ...props });
  }

  /** Valida um cupom novo antes de gravar. */
  static assertValidNew(data: NewCoupon, now: Date): void {
    assertPeriod(data.startsAt, data.endsAt);
    if (data.status === "active") assertNotOver(data.endsAt, now);
  }

  get id(): string {
    return this.props.id;
  }
  get storeId(): string {
    return this.props.storeId;
  }
  get status(): CouponStatus {
    return this.props.status;
  }
  get totalQuantity(): number {
    return this.props.totalQuantity;
  }
  get title(): string {
    return this.props.title;
  }

  get review(): CouponReview {
    return this.props.review;
  }

  /** Dá para pegar agora: ativa, aprovada pela ARP e dentro de [startsAt, endsAt). */
  isClaimableAt(now: Date): boolean {
    const { status, review, startsAt, endsAt } = this.props;
    return (
      status === "active" &&
      review === "approved" &&
      startsAt <= now &&
      (endsAt === null || now < endsAt)
    );
  }

  /** Revisão da ARP (Fase 2): aprova ou recusa com motivo. */
  decide(decision: "approve" | "reject", note: string | null): void {
    this.props = {
      ...this.props,
      review: decision === "approve" ? "approved" : "rejected",
      reviewNote: decision === "approve" ? null : note,
    };
  }

  /** O lojista mudou o cupom: volta para a fila da ARP. */
  resubmit(): void {
    this.props = { ...this.props, review: "pending", reviewNote: null };
  }

  /** Prazo de uso de um pego feito agora (para no fim da promoção, se ela pedir). */
  claimExpiresAt(now: Date): Date {
    const byWindow = new Date(now.getTime() + this.props.redeemWindowHours * HOUR_MS);
    const cutoff = claimCutoff(this.props);
    return cutoff && cutoff < byWindow ? cutoff : byWindow;
  }

  /** Nunca menos unidades do que já foram pegas (ativas no prazo + usadas). */
  assertCanReduceTotalTo(total: number, taken: number): void {
    if (total < taken) {
      throw new BusinessRuleError(
        `Já foram pegas ${taken} unidade(s); o total não pode ficar abaixo disso`,
        { totalQuantity: [`Mínimo: ${taken}`] },
      );
    }
  }

  /** Edição (só campos presentes). `taken` = unidades ocupadas agora. */
  update(changes: CouponChanges, taken: number): void {
    if (this.props.status === "ended") {
      throw new BusinessRuleError("Promoção encerrada não pode ser editada");
    }
    if (changes.totalQuantity !== undefined) {
      this.assertCanReduceTotalTo(changes.totalQuantity, taken);
    }
    const next = applyPatch(this.props, changes);
    assertPeriod(next.startsAt, next.endsAt);
    this.props = { ...next, weekdays: sortedDays(next.weekdays) };
  }

  changeStatus(status: CouponStatus, now: Date): void {
    if (status === this.props.status) return;
    if (!TRANSITIONS[this.props.status].includes(status)) {
      throw new BusinessRuleError(
        `Não é possível mudar de ${STATUS_LABEL[this.props.status]} para ${STATUS_LABEL[status]}`,
      );
    }
    if (status === "active") assertNotOver(this.props.endsAt, now);
    this.props = { ...this.props, status };
  }

  toState(): CouponProps {
    return { ...this.props };
  }
}

function sortedDays(days: readonly number[]): number[] {
  const unique = [...new Set(days)].sort((a, b) => a - b);
  if (unique.length === 0) throw ValidationError.field("weekdays", "Escolha ao menos um dia");
  return unique;
}

function assertPeriod(startsAt: Date, endsAt: Date | null): void {
  if (endsAt !== null && endsAt <= startsAt) {
    throw ValidationError.field("endsAt", "O fim precisa ser depois do início");
  }
}

function assertNotOver(endsAt: Date | null, now: Date): void {
  if (endsAt !== null && endsAt <= now) {
    throw new BusinessRuleError("O fim da promoção já passou; ajuste a data antes de ativar");
  }
}

/** Quando os pegos param de valer por causa do fim da promoção (null = não param). */
export function claimCutoff(p: Pick<CouponProps, "expiresWithPromotion" | "endsAt">): Date | null {
  return p.expiresWithPromotion ? p.endsAt : null;
}
