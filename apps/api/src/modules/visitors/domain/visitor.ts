import { ValidationError } from "../../../shared/domain/errors";

export type VisitorStatus = "active" | "blocked";

export interface VisitorProps {
  id: string;
  name: string;
  status: VisitorStatus;
  blockedReason: string | null;
}

/** Conta do app vista pelo painel: o painel só bloqueia e desbloqueia. */
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

  /** Bloqueado não entra no app nem usa o token que já tem. O motivo fica registrado. */
  block(reason: string | null | undefined): void {
    const trimmed = reason?.trim();
    if (!trimmed) throw ValidationError.field("reason", "Informe o motivo do bloqueio");
    this.props = { ...this.props, status: "blocked", blockedReason: trimmed };
  }

  unblock(): void {
    this.props = { ...this.props, status: "active", blockedReason: null };
  }

  toState(): VisitorProps {
    return { ...this.props };
  }
}
