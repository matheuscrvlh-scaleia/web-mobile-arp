import { App, npsReportQuerySchema, npsReportSchema, ROUTES } from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { offsetOf } from "../../shared/application/pagination";
import { BUSINESS_TIME_ZONE } from "../../shared/domain/time";
import type { CoreDeps } from "../../shared/infra/core";
import { sql } from "../../shared/infra/database/sql";
import { visitorOf } from "../../shared/infra/http/auth";
import { createRouter } from "../../shared/infra/http/router";
import { iso } from "../../shared/infra/presenters";

const { APP_ROUTES } = App;
const DEFAULT_REPORT_DAYS = 90;

/**
 * Novidades (comunicados que a ARP mandou a todos por push) e NPS do app.
 * Só leitura e uma gravação simples: sem casos de uso próprios.
 */
export function createFeedbackModule(core: CoreDeps) {
  const { db, clock, audit } = core;

  const panel: FastifyPluginAsyncZod = async (api) => {
    const r = createRouter(api, { audience: "admin", tag: "Relatórios" });
    r.route(
      ROUTES.clubReports.nps,
      { querystring: npsReportQuerySchema, response: { 200: npsReportSchema } },
      async (request) => {
        const q = request.query;
        const from = q.from
          ? sql`(${q.from}::date)::timestamp at time zone ${BUSINESS_TIME_ZONE}`
          : sql`${clock.now()}::timestamptz - make_interval(days => ${DEFAULT_REPORT_DAYS})`;
        const to = q.to
          ? sql`(${q.to}::date + 1)::timestamp at time zone ${BUSINESS_TIME_ZONE}`
          : sql`'infinity'::timestamptz`;
        const range = sql`n.created_at >= ${from} and n.created_at < ${to}`;
        const [summary, rows] = await Promise.all([
          db.one<{ total: number; promoters: number; passives: number; detractors: number }>(sql`
            select count(*)::int as total,
                   count(*) filter (where n.score >= 9)::int as promoters,
                   count(*) filter (where n.score between 7 and 8)::int as passives,
                   count(*) filter (where n.score <= 6)::int as detractors
            from visitors.nps_responses n where ${range}
          `),
          db.many<{
            id: string;
            score: number;
            comment: string | null;
            visitor_id: string | null;
            visitor_name: string | null;
            platform: string | null;
            created_at: Date;
          }>(sql`
            select n.id, n.score, n.comment, v.id as visitor_id, v.name as visitor_name,
                   n.platform, n.created_at
            from visitors.nps_responses n
            left join visitors.visitors v on v.id = n.visitor_id
            where ${range}
            order by n.created_at desc, n.id desc
            limit ${q.pageSize} offset ${offsetOf(q)}
          `),
        ]);
        const { total } = summary;
        return {
          data: rows.map((n) => ({
            id: n.id,
            score: n.score,
            comment: n.comment,
            visitor: n.visitor_id ? { id: n.visitor_id, name: n.visitor_name ?? "" } : null,
            platform: n.platform,
            createdAt: iso(n.created_at),
          })),
          meta: {
            page: q.page,
            pageSize: q.pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
          },
          summary: {
            ...summary,
            nps:
              total > 0
                ? Math.round(((summary.promoters - summary.detractors) / total) * 100)
                : null,
          },
        };
      },
    );
  };

  const app: FastifyPluginAsyncZod = async (api) => {
    const r = createRouter(api, { audience: "app", tag: "App: novidades e NPS" });

    r.route(APP_ROUTES.news, { response: { 200: App.newsSchema } }, async () => {
      const rows = await db.many<{
        id: string;
        title: string;
        body: string;
        deep_link: string | null;
        sent_at: Date;
      }>(sql`
        select id, title, body, deep_link, sent_at
        from marketing.push_notifications
        where status = 'sent' and audience in ('all', 'opted_in')
          and sent_at > ${clock.now()}::timestamptz - make_interval(days => ${App.NEWS_MAX_AGE_DAYS})
        order by sent_at desc
        limit ${App.NEWS_LIMIT}
      `);
      return {
        data: rows.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          deepLink: n.deep_link,
          sentAt: iso(n.sent_at),
        })),
      };
    });

    r.route(APP_ROUTES.nps, { body: App.npsBodySchema }, async (request, reply) => {
      const actor = visitorOf(request);
      const platform = request.headers["x-platform"];
      const version = request.headers["x-app-version"];
      const { id } = await db.one<{ id: string }>(sql`
        insert into visitors.nps_responses (visitor_id, score, comment, platform, app_version)
        values (${actor.id}, ${request.body.score}, ${request.body.comment || null},
                ${typeof platform === "string" ? platform.slice(0, 20) : null},
                ${typeof version === "string" ? version.slice(0, 40) : null})
        returning id
      `);
      await audit.log({
        actor,
        action: "nps.answer",
        entityType: "nps_response",
        entityId: id,
        changes: { score: request.body.score },
      });
      return reply.status(204).send();
    });
  };

  const routes: FastifyPluginAsyncZod = async (api) => {
    await api.register(panel);
    await api.register(app, { prefix: "/app" });
  };
  return { routes };
}
