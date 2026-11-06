import { BusinessRuleError, ConflictError, ValidationError } from "../../../shared/domain/errors";
import { applyPatch } from "../../../shared/domain/patch";
import { EventSchedule, type EventScheduleProps } from "./event-schedule";

export type EventStatus = "draft" | "published" | "paused" | "cancelled";
export type Tone = "green" | "ink" | "clay" | "sand" | "deep";

export interface AgendaEventDetails {
  title: string;
  categoryId: string;
  description: string;
  imageUrl: string | null;
  tone: Tone | null;
  icon: string | null;
  place: string;
  floorId: string | null;
  storeId: string | null;
  isLongRunning: boolean;
  awardsSeal: boolean;
  status: EventStatus;
  /** Arquivado: fora das listas do painel (nunca com status published). */
  archivedAt: Date | null;
}

export type AgendaEventProps = AgendaEventDetails & EventScheduleProps & { id: string };
export type NewAgendaEvent = Omit<AgendaEventProps, "id" | "archivedAt">;
/** PATCH: undefined = mantém; null = limpa. */
export type AgendaEventChanges = Partial<NewAgendaEvent>;

/** Evento da agenda. A recorrência é validada sempre no estado final. */
export class AgendaEvent {
  private constructor(
    private details: AgendaEventDetails & { id: string },
    private schedule: EventSchedule,
  ) {}

  /** Valida um evento novo (lança ValidationError por campo). */
  static validateNew(data: NewAgendaEvent): NewAgendaEvent {
    const schedule = EventSchedule.create(data);
    return { ...data, ...schedule.toState() };
  }

  static restore(props: AgendaEventProps): AgendaEvent {
    const { recurrence, startsOn, endsOn, weekdays, startTime, endTime, ...details } = props;
    const schedule = EventSchedule.restore({
      recurrence,
      startsOn,
      endsOn,
      weekdays,
      startTime,
      endTime,
    });
    return new AgendaEvent(details, schedule);
  }

  get id(): string {
    return this.details.id;
  }
  get status(): EventStatus {
    return this.details.status;
  }

  /** Aplica um PATCH: junta o estado atual com as mudanças e valida o resultado. */
  update(changes: AgendaEventChanges): void {
    const merged = applyPatch(this.toState(), changes);
    const { recurrence, startsOn, endsOn, weekdays, startTime, endTime, ...details } = merged;
    if (details.archivedAt && details.status === "published") {
      throw new BusinessRuleError("Desarquive o evento antes de publicar.");
    }
    this.schedule = EventSchedule.create({
      recurrence,
      startsOn,
      endsOn,
      weekdays,
      startTime,
      endTime,
    });
    this.details = details;
  }

  /** Nova data de início (o fim anda junto, mantendo a duração). A situação não muda. */
  postpone(startsOn: string): void {
    if (startsOn === this.schedule.toState().startsOn) {
      throw ValidationError.field("startsOn", "Escolha uma data diferente da atual");
    }
    this.schedule = EventSchedule.create(this.schedule.movedTo(startsOn));
  }

  /**
   * Excluir só o que ninguém usou: sem interessados (quem marcou interesse
   * perderia o evento sem aviso). Com uso, arquive.
   */
  assertDeletable(interests: number): void {
    if (interests > 0) {
      throw new ConflictError(
        `${interests === 1 ? "1 pessoa marcou" : `${interests} pessoas marcaram`} interesse neste evento: arquive em vez de excluir.`,
      );
    }
  }

  /** Sai das listas e do calendário do painel; publicado é pausado antes (sai do app). */
  archive(now: Date): void {
    if (this.details.archivedAt) return;
    const status = this.details.status === "published" ? "paused" : this.details.status;
    this.details = { ...this.details, status, archivedAt: now };
  }

  /** Volta às listas como estava (pausado, cancelado ou rascunho), nunca direto no app. */
  unarchive(): void {
    this.details = { ...this.details, archivedAt: null };
  }

  toState(): AgendaEventProps {
    return { ...this.details, ...this.schedule.toState() };
  }
}
