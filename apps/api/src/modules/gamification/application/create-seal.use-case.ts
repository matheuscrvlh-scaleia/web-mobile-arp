import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { nextAvailableSlug, slugify } from "../../../shared/domain/text";
import { assertAvailability } from "../domain/availability";
import type { NewSeal } from "../domain/seal";
import type { GamificationDeps } from "./gamification-deps";

export type CreateSealInput = Omit<
  NewSeal,
  "slug" | "description" | "availableFrom" | "availableUntil"
> & {
  slug?: string;
  description?: string | null;
  availableFrom?: Date | null;
  availableUntil?: Date | null;
};

/** Cria um selo. Sem slug, gera um a partir do nome (único). */
export class CreateSealUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(input: CreateSealInput, actor: StaffActor): Promise<string> {
    const { seals, audit, uow } = this.deps;
    const window = {
      availableFrom: input.availableFrom ?? null,
      availableUntil: input.availableUntil ?? null,
    };
    assertAvailability(window);
    return uow.run(async () => {
      const slug = input.slug ?? (await this.freeSlug(input.name));
      const seal = await seals.create({
        ...input,
        ...window,
        slug,
        description: input.description ?? null,
      });
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
