import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { CoreDeps } from "../../shared/infra/core";
import { SharpImageProcessor } from "../../shared/infra/images";
import { GetSettingsUseCase } from "./application/get-settings.use-case";
import { UpdateSettingsUseCase } from "./application/update-settings.use-case";
import { UploadImageUseCase } from "./application/upload-image.use-case";
import { platformRoutes } from "./http/platform.routes";
import { AuditLogQueries } from "./infra/audit-logs.queries";
import { PgSettingsStore } from "./infra/pg-settings-store";

export function createPlatformModule(core: CoreDeps) {
  const { db, uow, audit, clock, storage, config } = core;
  const settings = new PgSettingsStore(db);
  const getSettings = new GetSettingsUseCase({ settings });

  const routes: FastifyPluginAsyncZod = async (app) => {
    await app.register(
      platformRoutes({
        getSettings,
        updateSettings: new UpdateSettingsUseCase({ settings, audit, uow, clock }),
        uploadImage: new UploadImageUseCase({
          storage,
          images: new SharpImageProcessor(),
          audit,
          clock,
          maxBytes: config.uploadMaxBytes,
        }),
        auditLogs: new AuditLogQueries(db),
        uploadMaxBytes: config.uploadMaxBytes,
      }),
    );
  };

  return { routes };
}
