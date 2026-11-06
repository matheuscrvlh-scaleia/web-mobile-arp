import { BusinessRuleError, ValidationError } from "../../../shared/domain/errors";

export type VisitorStatus = "active" | "blocked";

export interface VisitorProps {
  id: string;
  name: string;
  status: VisitorStatus;
  blockedReason: string | null;
  /** LGPD: dados pessoais apagados (a conta não volta). */
  anonymizedAt: Date | null;
}

export const ANONYMIZED_NAME = "Visitante anonimizado";
export const ANONYMIZED_BLOCK_REASON = "Dados pessoais apagados a pedido (LGPD)";

/** Conta do app vista pelo painel: o painel bloqueia, desbloqueia e anonimiza. */
export class Visitor {
  private constructor(private props: VisitorProps) {}

  static restore(props: VisitorProps): Visitor {
    return new Visitor({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get status(): VisitorStatus {
    return this.props.status;
  }
  get isAnonymized(): boolean {
    return this.props.anonymizedAt !== null;
  }

  /** Bloqueado não entra no app nem usa o token que já tem. O motivo fica registrado. */
  block(reason: string | null | undefined): void {
    const trimmed = reason?.trim();
    if (!trimmed) throw ValidationError.field("reason", "Informe o motivo do bloqueio");
    this.props = { ...this.props, status: "blocked", blockedReason: trimmed };
  }

  unblock(): void {
    if (this.isAnonymized) {
      throw new BusinessRuleError(
        "Conta anonimizada não volta: os dados pessoais já foram apagados",
      );
    }
    this.props = { ...this.props, status: "active", blockedReason: null };
  }

  /**
   * LGPD (art. 18): apaga os dados pessoais. Irreversível; a conta fica
   * bloqueada para sempre. Os números (cupons, selos, trocas) continuam.
   */
  anonymize(reason: string, now: Date): void {
    if (this.isAnonymized) throw new BusinessRuleError("Este visitante já foi anonimizado");
    if (reason.trim().length < 3) {
      throw ValidationError.field("reason", "Escreva o motivo (ex.: pedido do titular por e-mail)");
    }
    this.props = {
      ...this.props,
      name: ANONYMIZED_NAME,
      status: "blocked",
      blockedReason: ANONYMIZED_BLOCK_REASON,
      anonymizedAt: now,
    };
  }

  toState(): VisitorProps {
    return { ...this.props };
  }
}
