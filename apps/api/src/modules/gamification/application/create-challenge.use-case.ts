import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { ValidationError } from "../../../shared/domain/errors";
import { assertAvailability } from "../domain/availability";
import { type NewChallenge, normalizeChallengeTrigger } from "../domain/challenge";
import {
  assertChallengeReferences,
  CAMPAIGN_NOT_FOUND,
  couponStoreOf,
  type GamificationDeps,
} from "./gamification-deps";

export type CreateChallengeInput = Omit<
  NewChallenge,
  | "storeId"
  | "eventId"
  | "product"
  | "autoTrigger"
  | "couponId"
  | "availableFrom"
  | "availableUntil"
  | "sortOrder"
  | "points"
> & {
  points?: number | null;
  /** Sem ordem: entra no fim da campanha. */
  sortOrder?: number;
  availableFrom?: Date | null;
  availableUntil?: Date | null;
  autoTrigger?: NewChallenge["autoTrigger"];
  couponId?: string | null;
  storeId?: string | null;
  product?: string | null;
  eventId?: string | null;
};

export class CreateChallengeUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(input: CreateChallengeInput, actor: StaffActor): Promise<string> {
    const { campaigns, challenges, audit, uow } = this.deps;
    const data: Omit<NewChallenge, "sortOrder"> & { sortOrder?: number } =
      normalizeChallengeTrigger({
        ...input,
        autoTrigger: input.autoTrigger ?? null,
        couponId: input.couponId ?? null,
        storeId: input.storeId ?? null,
        product: input.product ?? null,
        eventId: input.eventId ?? null,
        availableFrom: input.availableFrom ?? null,
        availableUntil: input.availableUntil ?? null,
        points: input.points ?? null,
      });
    assertAvailability(data);
    return uow.run(async () => {
      if (!(await campaigns.findById(data.campaignId))) {
        throw ValidationError.field("campaignId", CAMPAIGN_NOT_FOUND);
      }
      // Gatilho de cupom: o desafio é da loja do cupom.
      data.storeId = (await couponStoreOf(this.deps, data.couponId)) ?? data.storeId;
      await assertChallengeReferences(this.deps, data);
      const challenge = await challenges.create({
        ...data,
        sortOrder: data.sortOrder ?? (await challenges.nextSortOrder(data.campaignId)),
      });
      await audit.log({
        actor,
        action: "challenge.create",
        entityType: "challenge",
        entityId: challenge.id,
        changes: snapshot(challenge.toState()),
      });
      return challenge.id;
    });
  }
}
