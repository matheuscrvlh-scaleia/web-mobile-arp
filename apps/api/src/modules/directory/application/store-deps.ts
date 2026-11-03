import type { ImageCleanup } from "../../../shared/application/image-variants";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { ValidationError } from "../../../shared/domain/errors";
import type { DirectoryReferences, StoreRefs, StoreRepository } from "../domain/repositories";

export interface StoreUseCaseDeps {
  stores: StoreRepository;
  references: DirectoryReferences;
  audit: AuditLogger;
  uow: UnitOfWork;
  /** Apaga capa/logo trocadas depois do commit. */
  images: ImageCleanup;
}

export const STORE_NOT_FOUND = "Loja não encontrada";

const REFERENCE_MESSAGE: Record<string, string> = {
  categoryId: "Categoria não encontrada",
  extraCategoryIds: "Categoria extra não encontrada",
  blockId: "Bloco não encontrado",
  floorId: "Andar não encontrado",
};

/** Categorias, bloco e andar informados precisam existir (erro por campo). */
export async function assertReferences(
  references: DirectoryReferences,
  refs: StoreRefs,
): Promise<void> {
  const missing = await references.missing(refs);
  if (missing.length === 0) return;
  throw new ValidationError(
    "Referência inexistente",
    Object.fromEntries(
      missing.map((field) => [field, [REFERENCE_MESSAGE[field] ?? "Não encontrado"]]),
    ),
  );
}
