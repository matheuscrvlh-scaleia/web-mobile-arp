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

/* Importação do site ------------------------------------------------------ */

/** Evento lido do site, já no formato da agenda (a categoria vem do gestor). */
export interface SiteEvent {
  /** Id do post no WordPress. */
  siteId: number;
  siteUrl: string;
  event: Omit<NewAgendaEvent, "categoryId" | "status">;
}

/** Eventos do site que terminam hoje ou depois. `failed` = posts sem data legível. */
export interface SiteEventSource {
  upcoming(today: string): Promise<{ events: SiteEvent[]; failed: number }>;
}

/** Posts do site já importados (inclusive os que o gestor apagou depois). */
export interface SiteImportLog {
  importedIds(siteIds: readonly number[]): Promise<Set<number>>;
  /** ConflictError se outra importação gravou o mesmo post antes. */
  record(entry: { siteId: number; eventId: string; siteUrl: string }): Promise<void>;
}
