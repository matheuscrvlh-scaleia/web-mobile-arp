import type { AuditLog } from "@arp/contracts";
import { ArrowRight, Bot, ChevronDown, ExternalLink, Smartphone } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { cn } from "@/shared/lib/cn";
import { formatDateTime, formatRelative } from "@/shared/lib/format";
import { Avatar } from "@/shared/ui";
import {
  actionLabel,
  changeRows,
  entityHref,
  entityLabel,
  fieldLabel,
  formatValue,
} from "../lib/describe";

function ActorMark({ actor }: { actor: AuditLog["actor"] }) {
  if (actor.type === "system")
    return (
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-900 text-white"
      >
        <Bot className="size-4" />
      </span>
    );
  if (actor.type === "visitor")
    return (
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full bg-marca/25 text-green-800"
      >
        <Smartphone className="size-4" />
      </span>
    );
  return <Avatar name={actor.name ?? "?"} />;
}

const ACTOR_KIND = { staff: "Equipe", visitor: "Visitante (app)", system: "Sistema" } as const;

/** Uma linha do histórico: quem, o quê, quando; abre para mostrar "de → para". */
export function AuditEntry({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rows = changeRows(log.changes);
  const href = entityHref(log);
  const who = log.actor.name ?? ACTOR_KIND[log.actor.type];

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <ActorMark actor={log.actor} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-neutral-800">
            <span className="font-semibold text-neutral-900">{who}</span> {actionLabel(log.action)}{" "}
            <span className="font-medium">{entityLabel(log.entityType).toLowerCase()}</span>
            {href && (
              <Link
                to={href}
                className="ml-1.5 inline-flex items-center gap-1 text-xs text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
              >
                abrir <ExternalLink className="size-3" aria-hidden />
              </Link>
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-neutral-500">
            <time dateTime={log.createdAt} title={formatDateTime(log.createdAt)}>
              {formatRelative(log.createdAt)} · {formatDateTime(log.createdAt)}
            </time>
            <span className="font-mono">{log.action}</span>
            {log.ip && <span>IP {log.ip}</span>}
          </p>
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-xs text-neutral-600 transition hover:bg-neutral-900/[0.06] hover:text-neutral-900"
          >
            {rows.length === 1 ? "1 campo" : `${rows.length} campos`}
            <ChevronDown
              className={cn("size-3.5 transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </button>
        )}
      </div>
      {open && rows.length > 0 && (
        <dl
          id={panelId}
          className="mt-3 ml-13 grid gap-1.5 rounded-2xl bg-neutral-900/[0.03] p-3 text-sm"
        >
          {rows.map((r) => (
            <div
              key={r.field}
              className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-[12rem_minmax(0,1fr)]"
            >
              <dt className="text-xs font-medium text-neutral-500 sm:pt-0.5">
                {fieldLabel(r.field)}
              </dt>
              <dd className="flex min-w-0 flex-wrap items-center gap-2 break-words">
                {r.kind === "diff" ? (
                  <>
                    <span className="rounded-md bg-red-50 px-1.5 text-red-700 line-through decoration-red-700/40">
                      <span className="sr-only">de </span>
                      {formatValue(r.from)}
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-neutral-400" aria-hidden />
                    <span className="rounded-md bg-green-50 px-1.5 text-green-700">
                      <span className="sr-only">para </span>
                      {formatValue(r.to)}
                    </span>
                  </>
                ) : (
                  <span className="text-neutral-800">{formatValue(r.to)}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}
