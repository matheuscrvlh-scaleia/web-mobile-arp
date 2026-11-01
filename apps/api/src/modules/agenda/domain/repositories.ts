import type { AgendaEvent, NewAgendaEvent } from "./agenda-event";
import type { EventCategory, NewEventCategory } from "./event-category";

export interface EventCategoryRepository {
  findById(id: string): Promise<EventCategory | null>;
  /** ConflictError se o nome já existir. */
  create(data: NewEventCategory): Promise<EventCategory>;
  save(category: EventCategory): Promise<void>;
  /** ConflictError se houver eventos na categoria. */
  delete(id: string): Promise<void>;
}

export interface AgendaEventRepository {
  findById(id: string): Promise<AgendaEvent | null>;
  create(data: NewAgendaEvent): Promise<AgendaEvent>;
  save(event: AgendaEvent): Promise<void>;
  /** ConflictError se algo ainda aponta para o evento (ex.: desafio). */
  delete(id: string): Promise<void>;
}

/** Existência das referências do evento (categoria, andar, loja). */
export interface AgendaReferences {
  categoryExists(id: string): Promise<boolean>;
  floorExists(id: string): Promise<boolean>;
  storeExists(id: string): Promise<boolean>;
}
