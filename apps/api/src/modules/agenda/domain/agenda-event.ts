import { BusinessRuleError } from "../../../shared/domain/errors";
import { applyPatch } from "../../../shared/domain/patch";
import { EventSchedule, type EventScheduleProps } from "./event-schedule";

export type EventStatus = "draft" | "published" | "cancelled";
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
}

export type AgendaEventProps = AgendaEventDetails & EventScheduleProps & { id: string };
export type NewAgendaEvent = Omit<AgendaEventProps, "id">;
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
    const { recurrence, startsOn, endsOn, weekday, startTime, endTime, ...details } = props;
    const schedule = EventSchedule.restore({
      recurrence,
      startsOn,
      endsOn,
      weekday,
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
    const { recurrence, startsOn, endsOn, weekday, startTime, endTime, ...details } = merged;
    this.schedule = EventSchedule.create({
      recurrence,
      startsOn,
      endsOn,
      weekday,
      startTime,
      endTime,
    });
    this.details = details;
  }

  /** Só rascunho pode ser apagado; publicado se cancela (mantém o histórico). */
  assertDeletable(): void {
    if (this.details.status !== "draft") {
      throw new BusinessRuleError(
        "Só rascunhos podem ser apagados. Para tirar do ar, cancele o evento.",
      );
    }
  }

  toState(): AgendaEventProps {
    return { ...this.details, ...this.schedule.toState() };
  }
}
