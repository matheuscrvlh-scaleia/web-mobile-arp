import { ValidationError } from "../../../shared/domain/errors";
import { applyPatch } from "../../../shared/domain/patch";
import { slugify } from "../../../shared/domain/text";
import { type DailyHours, isOpenNow } from "./opening-hours";

export type StoreStatus = "active" | "inactive";

export interface StoreProps {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  blockId: string;
  floorId: string;
  description: string;
  icon: string;
  brandColor: string;
  coverImageUrl: string | null;
  logoUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  mapX: number | null;
  mapY: number | null;
  hours: DailyHours[];
  status: StoreStatus;
}

export type NewStore = Omit<StoreProps, "id">;
export type StoreChanges = Partial<Omit<StoreProps, "id">>;

/** Posição do pino: os dois eixos juntos ou nenhum. */
function assertLocation(mapX: number | null, mapY: number | null): void {
  if ((mapX === null) !== (mapY === null)) {
    throw new ValidationError("Informe as duas coordenadas do pino (ou nenhuma)", {
      [mapX === null ? "mapX" : "mapY"]: ["Informe as duas coordenadas do pino"],
    });
  }
}

/** Um horário por dia; abrir e fechar no mesmo minuto não significa nada. */
function assertHours(hours: readonly DailyHours[]): void {
  const days = new Set<number>();
  for (const h of hours) {
    if (days.has(h.weekday)) throw ValidationError.field("hours", "Dia da semana repetido");
    if (h.opensAt === h.closesAt) {
      throw ValidationError.field("hours", "Abertura e fechamento no mesmo horário");
    }
    days.add(h.weekday);
  }
}

export function validateNewStore(data: NewStore): NewStore {
  assertLocation(data.mapX, data.mapY);
  assertHours(data.hours);
  return { ...data, hours: sortHours(data.hours) };
}

function sortHours(hours: readonly DailyHours[]): DailyHours[] {
  return [...hours].sort((a, b) => a.weekday - b.weekday);
}

/** Slug sugerido a partir do nome (o repositório garante que é único). */
export function slugBaseFor(name: string): string {
  return slugify(name);
}

/** Loja do guia. Não é apagada (tem histórico de cupons): é desativada. */
export class Store {
  private constructor(private props: StoreProps) {}

  static restore(props: StoreProps): Store {
    return new Store({ ...props, hours: sortHours(props.hours) });
  }

  get id(): string {
    return this.props.id;
  }
  get slug(): string {
    return this.props.slug;
  }
  get status(): StoreStatus {
    return this.props.status;
  }

  update(changes: StoreChanges): void {
    const next = applyPatch(this.props, changes);
    assertLocation(next.mapX, next.mapY);
    assertHours(next.hours);
    this.props = { ...next, hours: sortHours(next.hours) };
  }

  /** Reposiciona no mapa (opcionalmente em outro andar). */
  locate(location: { floorId?: string; mapX: number | null; mapY: number | null }): void {
    this.update(location);
  }

  deactivate(): void {
    this.props = { ...this.props, status: "inactive" };
  }

  isOpenAt(now: Date): boolean {
    return isOpenNow(this.props.hours, now);
  }

  toState(): StoreProps {
    return { ...this.props, hours: this.props.hours.map((h) => ({ ...h })) };
  }
}
