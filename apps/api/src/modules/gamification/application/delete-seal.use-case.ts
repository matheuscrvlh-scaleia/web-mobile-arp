import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { ConflictError, NotFoundError } from "../../../shared/domain/errors";
import { type GamificationDeps, SEAL_NOT_FOUND } from "./gamification-deps";

/** Exclui selo nunca usado: sem conquistas e sem desafio que o dê. */
export class DeleteSealUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    const { seals, audit, uow } = this.deps;
    await uow.run(async () => {
      const seal = await seals.findById(input.id);
      if (!seal) throw new NotFoundError(SEAL_NOT_FOUND);
      const { earned, challenges } = await seals.usage(seal.id);
      if (earned > 0) {
        throw new ConflictError(
          `Este selo já foi conquistado ${earned === 1 ? "1 vez" : `${earned} vezes`}: arquive em vez de excluir.`,
        );
      }
      if (challenges > 0) {
        throw new ConflictError(
          `${challenges === 1 ? "Um desafio usa" : `${challenges} desafios usam`} este selo: arquive em vez de excluir.`,
        );
      }
      await seals.delete(seal.id);
      await audit.log({
        actor,
        action: "seal.delete",
        entityType: "seal",
        entityId: seal.id,
        changes: snapshot(seal.toState()),
      });
    });
  }
}
