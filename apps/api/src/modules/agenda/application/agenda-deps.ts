import type { ImageCleanup } from "../../../shared/application/image-variants";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { type FieldErrors, ValidationError } from "../../../shared/domain/errors";
import type {
  AgendaEventRepository,
  AgendaReferences,
  EventCategoryRepository,
} from "../domain/repositories";

export interface EventCategoryUseCaseDeps {
  categories: EventCategoryRepository;
  audit: AuditLogger;
  uow: UnitOfWork;
}

export interface EventUseCaseDeps {
  events: AgendaEventRepository;
  references: AgendaReferences;
  audit: AuditLogger;
  uow: UnitOfWork;
  /** Apaga a imagem trocada/do evento apagado depois do commit. */
  images: ImageCleanup;
}

export const CATEGORY_NOT_FOUND = "Categoria não encontrada";
export const EVENT_NOT_FOUND = "Evento não encontrado";

/** Confere as referências que mudaram/foram informadas (categoria, andar, loja). */
export async function assertReferences(
  references: AgendaReferences,
  refs: { categoryId?: string; floorId?: string | null; storeId?: string | null },
): Promise<void> {
  const issues: FieldErrors = {};
  if (refs.categoryId && !(await references.categoryExists(refs.categoryId))) {
    issues.categoryId = ["Categoria não encontrada"];
  }
  if (refs.floorId && !(await references.floorExists(refs.floorId))) {
    issues.floorId = ["Andar não encontrado"];
  }
  if (refs.storeId && !(await references.storeExists(refs.storeId))) {
    issues.storeId = ["Loja não encontrada"];
  }
  if (Object.keys(issues).length > 0) throw new ValidationError("Referência inválida", issues);
}
