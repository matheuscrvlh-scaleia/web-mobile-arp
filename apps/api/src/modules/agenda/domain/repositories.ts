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
  /** Quantas pessoas marcaram interesse (excluir só sem nenhuma). */
  countInterests(id: string): Promise<number>;
}

/** Existência das referências do evento (categoria, andar, loja). */
export interface AgendaReferences {
  categoryExists(id: string): Promise<boolean>;
  floorExists(id: string): Promise<boolean>;
  storeExists(id: string): Promise<boolean>;
}

/* Sincronização com o site ------------------------------------------------ */

/** Evento lido do site, já no formato da agenda (a categoria vem do gestor). */
export interface SiteEvent {
  /** Id do post no WordPress. */
  siteId: number;
  siteUrl: string;
  event: Omit<NewAgendaEvent, "categoryId" | "status">;
}

export interface SiteSnapshot {
  /** Eventos que terminam hoje ou depois, já legíveis. */
  events: SiteEvent[];
  /** Id de todo post que existe no site (inclusive passados e ilegíveis). */
  allIds: Set<number>;
  /** Posts sem data legível. */
  failed: number;
}

export interface SiteEventSource {
  snapshot(today: string): Promise<SiteSnapshot>;
}

/** Post do site ↔ evento daqui (eventId null = o evento foi apagado aqui). */
export interface SiteLink {
  siteId: number;
  eventId: string | null;
}

export interface SiteImportLog {
  all(): Promise<SiteLink[]>;
  /** Liga o post ao evento. ConflictError se outra sincronização ligou antes. */
  record(entry: { siteId: number; eventId: string; siteUrl: string }): Promise<void>;
}
