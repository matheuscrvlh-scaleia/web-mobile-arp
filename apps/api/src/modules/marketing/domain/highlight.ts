import { ConflictError, type FieldErrors, ValidationError } from "../../../shared/domain/errors";
import { applyPatch } from "../../../shared/domain/patch";
import { type Phase, phaseOf } from "../../../shared/domain/time";

export type HighlightBadge = "featured" | "sponsored";
export type HighlightTarget = "event" | "coupon" | "store" | "url" | "none";
/** paused = "No ar" desligado (mantém a posição); archived sai da ordem do carrossel. */
export type HighlightStatus = "draft" | "published" | "paused" | "archived";

export interface HighlightProps {
  id: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  imageUrl: string | null;
  badge: HighlightBadge;
  targetType: HighlightTarget;
  targetId: string | null;
  targetUrl: string | null;
  sponsorStoreId: string | null;
  startsAt: Date;
  endsAt: Date;
  sortOrder: number;
  status: HighlightStatus;
}

export type NewHighlight = Omit<HighlightProps, "id" | "sortOrder">;
/** PATCH: undefined = mantém; null = limpa. */
export type HighlightChanges = Partial<NewHighlight>;

/** Alvos que apontam para outra entidade (precisam de targetId). */
export type EntityTarget = "event" | "coupon" | "store";

export function isEntityTarget(type: HighlightTarget): type is EntityTarget {
  return type === "event" || type === "coupon" || type === "store";
}

/** Mesmas regras de highlightIssues() do contrato, no estado final. */
export function highlightIssues(p: NewHighlight): FieldErrors {
  const issues: FieldErrors = {};
  if (isEntityTarget(p.targetType) && !p.targetId) issues.targetId = ["Escolha o destino"];
  if (p.targetType === "url" && !p.targetUrl) issues.targetUrl = ["Informe o link"];
  if (p.endsAt <= p.startsAt) issues.endsAt = ["O fim precisa ser depois do início"];
  return issues;
}

/** Valida e limpa o que não se aplica ao tipo de destino (o CHECK do banco nunca falha). */
function normalized<T extends NewHighlight>(p: T): T {
  const issues = highlightIssues(p);
  if (Object.keys(issues).length > 0) throw new ValidationError("Confira o destaque", issues);
  return {
    ...p,
    targetId: isEntityTarget(p.targetType) ? p.targetId : null,
    targetUrl: p.targetType === "url" ? p.targetUrl : null,
  };
}

/** Destaque do carrossel da home do app (inclui mídia patrocinada). */
export class Highlight {
  private constructor(private props: HighlightProps) {}

  static validateNew(data: NewHighlight): NewHighlight {
    return normalized(data);
  }

  static restore(props: HighlightProps): Highlight {
    return new Highlight({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get targetType(): HighlightTarget {
    return this.props.targetType;
  }
  get targetId(): string | null {
    return this.props.targetId;
  }

  update(changes: HighlightChanges): void {
    this.props = normalized(applyPatch(this.props, changes));
  }

  /** Saiu do arquivo agora (volta para o fim do carrossel). */
  static leftArchive(before: HighlightProps, after: HighlightProps): boolean {
    return before.status === "archived" && after.status !== "archived";
  }

  /** Excluir só o que nunca apareceu: com exibições, arquive (guarda o relatório). */
  assertDeletable(impressions: number): void {
    if (impressions > 0) {
      throw new ConflictError(
        `Este destaque já foi visto ${impressions === 1 ? "1 vez" : `${impressions} vezes`}: arquive para guardar os números do patrocinador.`,
      );
    }
  }

  phaseAt(now: Date): Phase {
    return phaseOf(now, this.props.startsAt, this.props.endsAt);
  }

  toState(): HighlightProps {
    return { ...this.props };
  }
}

/**
 * Nova ordem do carrossel: precisa listar todos os destaques, cada um uma vez
 * (evita perder ou duplicar posição com dois editores ao mesmo tempo).
 */
export function assertCompleteOrder(ids: readonly string[], existing: readonly string[]): void {
  const requested = new Set(ids);
  const current = new Set(existing);
  const complete =
    requested.size === ids.length &&
    requested.size === current.size &&
    [...requested].every((id) => current.has(id));
  if (!complete) {
    throw ValidationError.field(
      "ids",
      "A lista de destaques mudou enquanto você reordenava: recarregue a página e tente de novo.",
    );
  }
}
