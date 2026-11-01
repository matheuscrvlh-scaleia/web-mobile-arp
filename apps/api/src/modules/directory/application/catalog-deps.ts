import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import type { CatalogItem } from "../domain/catalog";
import type { CatalogRepository } from "../domain/repositories";

/** Um cadastro simples (andar, bloco, categoria, ponto do mapa). */
export interface CatalogDeps<P extends { id: string }> {
  /** Tipo na auditoria: floor, block, store_category, map_point. */
  entityType: string;
  notFoundMessage: string;
  repository: CatalogRepository<P, CatalogItem<P>>;
  audit: AuditLogger;
  uow: UnitOfWork;
}

export const FLOOR_NOT_FOUND = "Andar não encontrado";
export const BLOCK_NOT_FOUND = "Bloco não encontrado";
export const STORE_CATEGORY_NOT_FOUND = "Categoria não encontrada";
export const MAP_POINT_NOT_FOUND = "Ponto não encontrado";
