import { applyPatch } from "../../../shared/domain/patch";
export interface EventCategoryProps {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
}

export type NewEventCategory = Omit<EventCategoryProps, "id">;
export type EventCategoryChanges = Partial<NewEventCategory>;

export class EventCategory {
  private constructor(private props: EventCategoryProps) {}

  static restore(props: EventCategoryProps): EventCategory {
    return new EventCategory({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  update(changes: EventCategoryChanges): void {
    this.props = applyPatch(this.props, changes);
  }

  toState(): EventCategoryProps {
    return { ...this.props };
  }
}
