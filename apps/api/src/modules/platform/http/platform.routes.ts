import {
  appSettingsSchema,
  auditActorListSchema,
  auditLogPageSchema,
  listAuditLogsQuerySchema,
  ROUTES,
  updateAppSettingsBodySchema,
  uploadResponseSchema,
} from "@arp/contracts";
import type { FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ValidationError } from "../../../shared/domain/errors";
import { staffOf } from "../../../shared/infra/http/auth";
import { createRouter } from "../../../shared/infra/http/router";
import type { GetSettingsUseCase } from "../application/get-settings.use-case";
import type { UpdateSettingsUseCase } from "../application/update-settings.use-case";
import type { UploadImageInput, UploadImageUseCase } from "../application/upload-image.use-case";
import { isUploadFolder, PayloadTooLargeError, UnsupportedMediaTypeError } from "../domain/upload";
import type { AuditLogQueries } from "../infra/audit-logs.queries";

export interface PlatformRoutesDeps {
  getSettings: GetSettingsUseCase;
  updateSettings: UpdateSettingsUseCase;
  uploadImage: UploadImageUseCase;
  auditLogs: AuditLogQueries;
  uploadMaxBytes: number;
}

/** Lê o campo `file` (e `folder`, se vier antes dele) do multipart. */
async function readUpload(request: FastifyRequest, maxBytes: number): Promise<UploadImageInput> {
  if (!request.isMultipart()) {
    throw new UnsupportedMediaTypeError("Envie o arquivo como multipart/form-data");
  }
  const file = await request.file();
  if (!file || file.fieldname !== "file") {
    throw ValidationError.field("file", "Envie o arquivo no campo file");
  }

  let bytes: Buffer;
  try {
    bytes = await file.toBuffer();
  } catch (err) {
    if ((err as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
      throw new PayloadTooLargeError(maxBytes);
    }
    throw err;
  }
  if (file.file.truncated) throw new PayloadTooLargeError(maxBytes);

  const folderField = file.fields.folder;
  const folder =
    folderField && !Array.isArray(folderField) && folderField.type === "field"
      ? String(folderField.value)
      : "misc";
  if (!isUploadFolder(folder)) throw ValidationError.field("folder", "Pasta inválida");

  return { bytes, declaredMimeType: file.mimetype, folder };
}

export function platformRoutes(deps: PlatformRoutesDeps): FastifyPluginAsyncZod {
  return async (app) => {
    const r = createRouter(app, { audience: "admin", tag: "Plataforma" });

    r.route(ROUTES.settings.get, { response: { 200: appSettingsSchema } }, async () =>
      deps.getSettings.execute(),
    );

    r.route(
      ROUTES.settings.update,
      { body: updateAppSettingsBodySchema, response: { 200: appSettingsSchema } },
      async (request) => deps.updateSettings.execute(request.body, staffOf(request)),
    );

    r.route(
      ROUTES.auditLogs,
      { querystring: listAuditLogsQuerySchema, response: { 200: auditLogPageSchema } },
      async (request) => deps.auditLogs.list(request.query),
    );

    r.route(ROUTES.auditActors, { response: { 200: auditActorListSchema } }, async () =>
      deps.auditLogs.actors(),
    );

    r.route(
      ROUTES.uploads,
      { consumes: ["multipart/form-data"], response: { 201: uploadResponseSchema } },
      async (request, reply) => {
        const actor = staffOf(request);
        const input = await readUpload(request, deps.uploadMaxBytes);
        return reply.status(201).send(await deps.uploadImage.execute(input, actor));
      },
    );
  };
}
