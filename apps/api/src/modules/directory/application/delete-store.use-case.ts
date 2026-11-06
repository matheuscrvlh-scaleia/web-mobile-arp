import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { assertStoreAccess } from "../../../shared/application/store-scope";
import { ConflictError, NotFoundError } from "../../../shared/domain/errors";
import type { StoreUsage } from "../domain/repositories";
import { STORE_NOT_FOUND, type StoreUseCaseDeps } from "./store-deps";

const USAGE_LABEL: Record<keyof StoreUsage, [string, string]> = {
  coupons: ["cupom", "cupons"],
  challenges: ["desafio", "desafios"],
  events: ["evento", "eventos"],
  highlights: ["destaque", "destaques"],
  notifications: ["notificação", "notificações"],
  jobs: ["vaga", "vagas"],
  merchants: ["lojista", "lojistas"],
};

/** "3 cupons e 1 lojista" (só o que é maior que zero). */
export function describeUsage(usage: StoreUsage): string {
  const parts = (Object.keys(USAGE_LABEL) as (keyof StoreUsage)[])
    .filter((k) => usage[k] > 0)
    .map((k) => `${usage[k]} ${usage[k] === 1 ? USAGE_LABEL[k][0] : USAGE_LABEL[k][1]}`);
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}`;
}

/**
 * DELETE /stores/:id: apaga de vez uma loja criada por engano (duplicada,
 * teste). Com histórico (cupons, desafios, lojistas…) recusa com 409 e
 * manda desativar.
 */
export class DeleteStoreUseCase {
  constructor(private readonly deps: StoreUseCaseDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    const { stores, audit, uow, images } = this.deps;
    const removed = await uow.run(async () => {
      const store = await stores.findById(input.id);
      if (!store) throw new NotFoundError(STORE_NOT_FOUND);
      assertStoreAccess(actor, store.id);
      const usage = await stores.usage(store.id);
      const used = describeUsage(usage);
      if (used) {
        throw new ConflictError(`Esta loja já tem ${used}. Desative em vez de excluir.`);
      }
      const state = store.toState();
      await stores.delete(store.id);
      await audit.log({
        actor,
        action: "store.delete",
        entityType: "store",
        entityId: store.id,
        changes: snapshot({ name: state.name, slug: state.slug }),
      });
      return [state.coverImageUrl, state.logoUrl];
    });
    await images.discard(removed);
  }
}
