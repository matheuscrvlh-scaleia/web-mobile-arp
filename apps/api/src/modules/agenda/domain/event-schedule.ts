import { type FieldErrors, ValidationError } from "../../../shared/domain/errors";
import { addDaysToDate, daysBetween, weekdayOfDate } from "../../../shared/domain/time";

export type EventRecurrence = "single" | "range" | "weekly";

export interface EventScheduleProps {
  recurrence: EventRecurrence;
  /** YYYY-MM-DD. single: o dia; range: primeiro dia; weekly: a partir de quando vale. */
  startsOn: string;
  /** range: último dia; weekly: até quando (null = sem fim); single: sempre null. */
  endsOn: string | null;
  /** weekly: 0 = domingo … 6 = sábado; demais: null. */
  weekday: number | null;
  /** HH:mm */
  startTime: string | null;
  endTime: string | null;
}

const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function addIssue(issues: FieldErrors, field: string, message: string): void {
  const list = issues[field] ?? [];
  list.push(message);
  issues[field] = list;
}

/**
 * Quando um evento acontece: um dia (single), um período (range) ou toda
 * semana (weekly). Ninguém cadastra dia a dia — as ocorrências saem daqui.
 * Sempre normalizado (campos que não se aplicam à recorrência viram null),
 * então o CHECK do banco nunca falha.
 */
export class EventSchedule {
  private constructor(private readonly props: EventScheduleProps) {}

  /** Mesmas regras de recurrenceIssues() do contrato, mais as de horário. */
  static issues(props: EventScheduleProps): FieldErrors {
    const issues: FieldErrors = {};
    const p = EventSchedule.normalize(props);
    if (p.recurrence === "range" && !p.endsOn) {
      addIssue(issues, "endsOn", "Informe o último dia do período");
    }
    if (p.recurrence === "weekly" && p.weekday === null) {
      addIssue(issues, "weekday", "Escolha o dia da semana");
    }
    if (p.endsOn && p.endsOn < p.startsOn) {
      addIssue(issues, "endsOn", "O fim precisa ser depois do início");
    }
    if (
      p.recurrence === "weekly" &&
      p.weekday !== null &&
      p.endsOn &&
      p.endsOn >= p.startsOn &&
      firstWeekdayOnOrAfter(p.startsOn, p.weekday) > p.endsOn
    ) {
      addIssue(
        issues,
        "weekday",
        `Não há ${WEEKDAY_NAMES[p.weekday]} entre o início e o fim informados`,
      );
    }
    if (p.endTime && !p.startTime) {
      addIssue(issues, "startTime", "Informe o horário de início");
    }
    return issues;
  }

  /** Valida e normaliza; erros vão por campo (VALIDATION_ERROR). */
  static create(props: EventScheduleProps): EventSchedule {
    const issues = EventSchedule.issues(props);
    if (Object.keys(issues).length > 0) {
      throw new ValidationError("Confira as datas do evento", issues);
    }
    return new EventSchedule(EventSchedule.normalize(props));
  }

  /** Do banco (já coerente pelo CHECK): só normaliza, sem revalidar. */
  static restore(props: EventScheduleProps): EventSchedule {
    return new EventSchedule(EventSchedule.normalize(props));
  }

  private static normalize(props: EventScheduleProps): EventScheduleProps {
    switch (props.recurrence) {
      case "single":
        return { ...props, endsOn: null, weekday: null };
      case "range":
        return { ...props, weekday: null };
      case "weekly":
        return props;
    }
  }

  get recurrence(): EventRecurrence {
    return this.props.recurrence;
  }

  /** O evento acontece neste dia (YYYY-MM-DD)? */
  occursOn(date: string): boolean {
    const { recurrence, startsOn, endsOn, weekday } = this.props;
    if (date < startsOn) return false;
    if (recurrence === "single") return date === startsOn;
    if (endsOn && date > endsOn) return false;
    return recurrence === "range" || weekdayOfDate(date) === weekday;
  }

  /** Dias do intervalo [from, to] em que o evento acontece. */
  datesBetween(from: string, to: string): string[] {
    const dates: string[] = [];
    const total = daysBetween(from, to);
    for (let i = 0; i <= total; i++) {
      const date = addDaysToDate(from, i);
      if (this.occursOn(date)) dates.push(date);
    }
    return dates;
  }

  toState(): EventScheduleProps {
    return { ...this.props };
  }
}

function firstWeekdayOnOrAfter(date: string, weekday: number): string {
  const offset = (weekday - weekdayOfDate(date) + 7) % 7;
  return addDaysToDate(date, offset);
}
