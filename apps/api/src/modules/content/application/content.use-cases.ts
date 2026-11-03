import {
  CONTENT_PAGE_LABEL,
  type ContentPageKey,
  type CreateJobBody,
  type UpdateContentPageBody,
} from "@arp/contracts";
import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { Clock } from "../../../shared/application/ports/clock";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { assertStoreAccess } from "../../../shared/application/store-scope";
import { NotFoundError } from "../../../shared/domain/errors";
import type { CatalogItem } from "../../directory/domain/catalog";
import type { CatalogRepository } from "../../directory/domain/repositories";
import { type JobProps, jobExpiry } from "../domain/content";
import type { PgContentPages } from "../infra/pg-content-repositories";

export const JOB_NOT_FOUND = "Vaga não encontrada";

/** Edita um texto da ARP (cria a linha na primeira vez). */
export class UpdateContentPageUseCase {
  constructor(
    private readonly deps: { pages: PgContentPages; audit: AuditLogger; uow: UnitOfWork },
  ) {}

  async execute(
    input: { key: ContentPageKey; changes: UpdateContentPageBody },
    actor: StaffActor,
  ): Promise<void> {
    const { pages, audit, uow } = this.deps;
    await uow.run(async () => {
      await pages.upsert(input.key, CONTENT_PAGE_LABEL[input.key], input.changes, actor.id);
      await audit.log({
        actor,
        action: "content_page.update",
        entityType: "content_page",
        entityId: input.key,
        changes: snapshot({ ...input.changes, body: input.changes.body ? "(texto)" : undefined }),
      });
    });
  }
}

interface JobDeps {
  jobs: CatalogRepository<JobProps, CatalogItem<JobProps>>;
  /** Dias no ar (configuração jobDays). */
  jobDays: () => Promise<number>;
  clock: Clock;
  audit: AuditLogger;
  uow: UnitOfWork;
}

/** Publica a vaga; o lojista só na própria loja. Sai do ar sozinha em jobDays. */
export class CreateJobUseCase {
  constructor(private readonly deps: JobDeps) {}

  async execute(input: CreateJobBody, actor: StaffActor): Promise<string> {
    const { jobs, jobDays, clock, audit, uow } = this.deps;
    assertStoreAccess(actor, input.storeId);
    const expiresAt = jobExpiry(clock.now(), await jobDays());
    return uow.run(async () => {
      const job = await jobs.create({ ...input, expiresAt, createdBy: actor.id });
      await audit.log({
        actor,
        action: "job.create",
        entityType: "job",
        entityId: job.id,
        changes: snapshot(job.toState()),
      });
      return job.id;
    });
  }
}

/** Tira a vaga do ar antes do prazo (apaga). */
export class RemoveJobUseCase {
  constructor(private readonly deps: JobDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    const { jobs, audit, uow } = this.deps;
    await uow.run(async () => {
      const job = await jobs.findById(input.id);
      if (!job) throw new NotFoundError(JOB_NOT_FOUND);
      assertStoreAccess(actor, job.toState().storeId);
      await jobs.delete(job.id);
      await audit.log({
        actor,
        action: "job.delete",
        entityType: "job",
        entityId: job.id,
        changes: snapshot(job.toState()),
      });
    });
  }
}
