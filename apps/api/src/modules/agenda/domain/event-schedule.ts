import { type FieldErrors, ValidationError } from "../../../shared/domain/errors";
import { addDaysToDate, daysBetween, weekdayOfDate } from "../../../shared/domain/time";

export type EventRecurrence = "single" | "range" | "weekly";
export interface EventPeriod {
  startsOn: string;
  endsOn: string;
}

export interface EventScheduleProps {
  recurrence: EventRecurrence;
  /** YYYY-MM-DD. single: o dia; range: primeiro dia; weekly: a partir de quando vale. */
  startsOn: string;
  /** range: último dia; weekly: até quando (null = sem fim); single: sempre null. */
  endsOn: string | null;
  /** weekly: dias da semana (0 = domingo … 6 = sábado), em ordem; demais: null. */
  weekdays: number[] | null;
  /** range em 2+ períodos (em ordem, sem sobrepor); demais: null. */
  periods: EventPeriod[] | null;
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
    if (p.recurrence === "weekly" && !p.weekdays?.length) {
      addIssue(issues, "weekdays", "Escolha pelo menos um dia da semana");
    }
    if (p.endsOn && p.endsOn < p.startsOn) {
      addIssue(issues, "endsOn", "O fim precisa ser depois do início");
    }
    if (
      p.recurrence === "weekly" &&
      p.weekdays?.length &&
      p.endsOn &&
      p.endsOn >= p.startsOn &&
      p.weekdays.every((d) => firstWeekdayOnOrAfter(p.startsOn, d) > (p.endsOn as string))
    ) {
      const names = p.weekdays.map((d) => WEEKDAY_NAMES[d]).join(" nem ");
      addIssue(issues, "weekdays", `Não há ${names} entre o início e o fim informados`);
    }
    if (p.periods) {
      if (p.periods.some((x) => x.endsOn < x.startsOn)) {
        addIssue(issues, "periods", "Em cada período, o fim vem depois do início");
      } else if (
        p.periods.some((x, i) => i > 0 && x.startsOn <= (p.periods?.[i - 1]?.endsOn ?? ""))
      ) {
        addIssue(issues, "periods", "Os períodos não podem se sobrepor");
      }
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
        return { ...props, endsOn: null, weekdays: null, periods: null };
      case "range": {
        // 2+ períodos: o início e o fim do evento saem deles (o GiST usa os dois).
        const periods =
          props.periods && props.periods.length > 1
            ? [...props.periods].sort((a, b) => a.startsOn.localeCompare(b.startsOn))
            : null;
        if (!periods) return { ...props, weekdays: null, periods: null };
        const last = periods.reduce(
          (m, x) => (x.endsOn > m ? x.endsOn : m),
          periods[0]?.endsOn ?? "",
        );
        return {
          ...props,
          weekdays: null,
          periods,
          startsOn: periods[0]?.startsOn ?? props.startsOn,
          endsOn: last,
        };
      }
      case "weekly": {
        // Sem repetir e em ordem (o primeiro vira o "weekday" legado do app).
        const days = props.weekdays ? [...new Set(props.weekdays)].sort((a, b) => a - b) : null;
        return { ...props, weekdays: days?.length ? days : null, periods: null };
      }
    }
  }

  get recurrence(): EventRecurrence {
    return this.props.recurrence;
  }

  /** O evento acontece neste dia (YYYY-MM-DD)? */
  occursOn(date: string): boolean {
    const { recurrence, startsOn, endsOn, weekdays, periods } = this.props;
    if (date < startsOn) return false;
    if (recurrence === "single") return date === startsOn;
    if (endsOn && date > endsOn) return false;
    if (recurrence === "range") {
      return !periods || periods.some((p) => date >= p.startsOn && date <= p.endsOn);
    }
    return (weekdays ?? []).includes(weekdayOfDate(date));
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

  /** Primeiro dia da semana (campo legado que o app ainda lê). */
  get firstWeekday(): number | null {
    return this.props.weekdays?.[0] ?? null;
  }

  /**
   * Mesma agenda começando em `startsOn` (adiar): o fim anda os mesmos dias,
   * mantendo a duração do período.
   */
  movedTo(startsOn: string): EventScheduleProps {
    const shift = daysBetween(this.props.startsOn, startsOn);
    const endsOn = this.props.endsOn ? addDaysToDate(this.props.endsOn, shift) : null;
    const periods =
      this.props.periods?.map((p) => ({
        startsOn: addDaysToDate(p.startsOn, shift),
        endsOn: addDaysToDate(p.endsOn, shift),
      })) ?? null;
    return { ...this.props, startsOn, endsOn, periods };
  }

  toState(): EventScheduleProps {
    return {
      ...this.props,
      weekdays: this.props.weekdays ? [...this.props.weekdays] : null,
      periods: this.props.periods ? this.props.periods.map((p) => ({ ...p })) : null,
    };
  }
}

function firstWeekdayOnOrAfter(date: string, weekday: number): string {
  const offset = (weekday - weekdayOfDate(date) + 7) % 7;
  return addDaysToDate(date, offset);
}
