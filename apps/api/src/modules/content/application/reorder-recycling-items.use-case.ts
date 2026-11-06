import type { StaffActor } from "../../../shared/application/actor";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { ValidationError } from "../../../shared/domain/errors";
import type { PgRecyclingOrder } from "../infra/pg-recycling-order";

/** Nova ordem do Sustentarp: todos os itens, cada um uma vez. */
export class ReorderRecyclingItemsUseCase {
  constructor(
    private readonly deps: { order: PgRecyclingOrder; audit: AuditLogger; uow: UnitOfWork },
  ) {}

  async execute(input: { ids: string[] }, actor: StaffActor): Promise<void> {
    const { order, audit, uow } = this.deps;
    await uow.run(async () => {
      const existing = new Set(await order.lockAllIds());
      const requested = new Set(input.ids);
      const complete =
        requested.size === input.ids.length &&
        requested.size === existing.size &&
        input.ids.every((id) => existing.has(id));
      if (!complete) {
        throw ValidationError.field(
          "ids",
          "A lista mudou enquanto você reordenava: recarregue a página e tente de novo.",
        );
      }
      await order.apply(input.ids);
      await audit.log({
        actor,
        action: "recycling_item.reorder",
        entityType: "recycling_item",
        entityId: null,
        changes: { order: input.ids },
      });
    });
  }
}
