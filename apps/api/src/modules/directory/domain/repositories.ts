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
  /** Grava a ordem (sort_order = posição). Devolve quantos ids existiam. */
  reorder?(ids: readonly string[]): Promise<number>;
  /** Leva as lojas de um cadastro para outro (antes de apagar). Devolve quantas mudaram. */
  reassignStores?(fromId: string, toId: string): Promise<number>;
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
  /** O que está ligado à loja (com qualquer item, não pode ser excluída). */
  usage(id: string): Promise<StoreUsage>;
  /** Apaga a loja e o que é só dela (horários, seguidores, links de convite). */
  delete(id: string): Promise<void>;
}

export interface StoreUsage {
  coupons: number;
  challenges: number;
  events: number;
  highlights: number;
  notifications: number;
  jobs: number;
  merchants: number;
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
