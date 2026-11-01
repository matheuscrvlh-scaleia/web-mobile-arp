import { applyPatch } from "../../../shared/domain/patch";
export type SealStatus = "active" | "archived";

export interface SealProps {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  gradientFrom: string;
  gradientTo: string;
  sortOrder: number;
  status: SealStatus;
}

export type NewSeal = Omit<SealProps, "id">;
export type SealChanges = Partial<Omit<SealProps, "id">>;

/** Selo reutilizável entre campanhas. Arquivar tira dos cadastros novos sem mexer no histórico. */
export class Seal {
  private constructor(private props: SealProps) {}

  static restore(props: SealProps): Seal {
    return new Seal({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get slug(): string {
    return this.props.slug;
  }
  get isActive(): boolean {
    return this.props.status === "active";
  }

  update(changes: SealChanges): void {
    this.props = applyPatch(this.props, changes);
  }

  toState(): SealProps {
    return { ...this.props };
  }
}
