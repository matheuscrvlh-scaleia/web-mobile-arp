import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { nextAvailableSlug, slugify } from "../../../shared/domain/text";
import type { NewSeal } from "../domain/seal";
import type { GamificationDeps } from "./gamification-deps";

export type CreateSealInput = Omit<NewSeal, "slug" | "description"> & {
  slug?: string;
  description?: string | null;
};

/** Cria um selo. Sem slug, gera um a partir do nome (único). */
export class CreateSealUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(input: CreateSealInput, actor: StaffActor): Promise<string> {
    const { seals, audit, uow } = this.deps;
    return uow.run(async () => {
      const slug = input.slug ?? (await this.freeSlug(input.name));
      const seal = await seals.create({ ...input, slug, description: input.description ?? null });
      await audit.log({
        actor,
        action: "seal.create",
        entityType: "seal",
        entityId: seal.id,
        changes: snapshot(seal.toState()),
      });
      return seal.id;
    });
  }

  private async freeSlug(name: string): Promise<string> {
    const base = slugify(name);
    return nextAvailableSlug(base, await this.deps.seals.slugsLike(base));
  }
}
