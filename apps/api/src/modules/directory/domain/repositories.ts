import type {
  Block,
  BlockProps,
  Floor,
  FloorProps,
  MapPoint,
  MapPointProps,
  StoreCategory,
  StoreCategoryProps,
} from "./catalog";
import type { NewStore, Store } from "./store";

/**
 * Repositório de cadastro: create/save traduzem unicidade para ConflictError;
 * delete traduz "em uso" (FK) para ConflictError com a mensagem do cadastro.
 */
export interface CatalogRepository<P extends { id: string }, E> {
  findById(id: string): Promise<E | null>;
  create(data: Omit<P, "id">): Promise<E>;
  save(item: E): Promise<void>;
  delete(id: string): Promise<void>;
}

export type FloorRepository = CatalogRepository<FloorProps, Floor>;
export type BlockRepository = CatalogRepository<BlockProps, Block>;
export type StoreCategoryRepository = CatalogRepository<StoreCategoryProps, StoreCategory>;
export type MapPointRepository = CatalogRepository<MapPointProps, MapPoint>;

export interface StoreRepository {
  findById(id: string): Promise<Store | null>;
  /** Slugs já usados que começam com a base (para escolher "base-2", "base-3"…). */
  slugsStartingWith(base: string): Promise<Set<string>>;
  /** ConflictError se o slug já existir. */
  create(data: NewStore): Promise<Store>;
  /** Grava a loja e substitui os horários. */
  save(store: Store): Promise<void>;
}

/** Referências da loja checadas antes de gravar. */
export interface StoreRefs {
  categoryId?: string;
  extraCategoryIds?: readonly string[];
  blockId?: string;
  floorId?: string;
}

/** Checagem de referências antes de gravar (mensagem por campo em vez de erro de FK). */
export interface DirectoryReferences {
  missing(refs: StoreRefs): Promise<string[]>;
}
