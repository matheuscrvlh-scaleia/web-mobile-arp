import { applyPatch } from "../../../shared/domain/patch";

/*
 * Cadastros de apoio do guia: andares (com o desenho do mapa), blocos,
 * categorias de loja e pontos de referência. Regras simples — unicidade e
 * "apagar só sem uso" ficam garantidas pelo banco e traduzidas no repositório.
 */

export interface MapShapeData {
  kind: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FloorProps {
  id: string;
  level: number;
  label: string;
  shortLabel: string;
  layout: MapShapeData[];
}

export interface BlockProps {
  id: string;
  name: string;
  sortOrder: number;
}

export interface StoreCategoryProps {
  id: string;
  name: string;
  kind: "food" | "shop";
  icon: string;
  sortOrder: number;
}

export interface MapPointProps {
  id: string;
  floorId: string;
  icon: string;
  label: string;
  x: number;
  y: number;
}

/** Registro de cadastro com estado imutável por fora e edição parcial. */
export class CatalogItem<P extends { id: string }> {
  private constructor(private props: P) {}

  static restore<P extends { id: string }>(props: P): CatalogItem<P> {
    return new CatalogItem({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  update(changes: Partial<Omit<P, "id">>): void {
    // Omit<P, "id"> é um subconjunto de P; o TS não prova isso com P genérico.
    this.props = applyPatch(this.props, changes as Partial<P>);
  }

  toState(): P {
    return { ...this.props };
  }
}

export type Floor = CatalogItem<FloorProps>;
export type Block = CatalogItem<BlockProps>;
export type StoreCategory = CatalogItem<StoreCategoryProps>;
export type MapPoint = CatalogItem<MapPointProps>;
