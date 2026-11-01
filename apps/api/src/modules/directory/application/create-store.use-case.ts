import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { nextAvailableSlug } from "../../../shared/domain/text";
import { type NewStore, slugBaseFor, validateNewStore } from "../domain/store";
import { assertReferences, type StoreUseCaseDeps } from "./store-deps";

type Optional =
  | "coverImageUrl"
  | "logoUrl"
  | "phone"
  | "whatsapp"
  | "instagram"
  | "website"
  | "mapX"
  | "mapY";

/** Campos opcionais do contrato chegam undefined: na loja nova viram null. */
export type CreateStoreInput = Omit<NewStore, "slug" | Optional> & {
  slug?: string;
} & { [K in Optional]?: NewStore[K] | undefined };

function normalize(input: CreateStoreInput, slug: string): NewStore {
  return {
    ...input,
    slug,
    coverImageUrl: input.coverImageUrl ?? null,
    logoUrl: input.logoUrl ?? null,
    phone: input.phone ?? null,
    whatsapp: input.whatsapp ?? null,
    instagram: input.instagram ?? null,
    website: input.website ?? null,
    mapX: input.mapX ?? null,
    mapY: input.mapY ?? null,
  };
}

export class CreateStoreUseCase {
  constructor(private readonly deps: StoreUseCaseDeps) {}

  async execute(input: CreateStoreInput, actor: StaffActor): Promise<string> {
    const { stores, references, audit, uow } = this.deps;
    return uow.run(async () => {
      await assertReferences(references, input);
      // Slug explícito precisa estar livre (o repositório recusa); sem slug, gera um único.
      const slug =
        input.slug ??
        nextAvailableSlug(
          slugBaseFor(input.name),
          await stores.slugsStartingWith(slugBaseFor(input.name)),
        );
      const store = await stores.create(validateNewStore(normalize(input, slug)));
      await audit.log({
        actor,
        action: "store.create",
        entityType: "store",
        entityId: store.id,
        changes: snapshot(store.toState()),
      });
      return store.id;
    });
  }
}
