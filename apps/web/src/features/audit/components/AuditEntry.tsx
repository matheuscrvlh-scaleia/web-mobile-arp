import type { AuditLog } from "@arp/contracts";
import { ArrowRight, Bot, ChevronDown, Smartphone } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { cn } from "@/shared/lib/cn";
import { formatDateTime, formatRelative } from "@/shared/lib/format";
import { Avatar } from "@/shared/ui";
import { actionPhrase, changeRows, entityHref, formatValue } from "../lib/describe";

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

const ACTOR_KIND = { staff: "Alguém da equipe", visitor: "Um visitante", system: "O sistema" };

/**
 * Uma linha do histórico em português: "Maria criou a campanha Novembro ·
 * há 2 min", com o nome do item levando à tela dele. Abre para mostrar os
 * campos (de → para). Código da ação e IP só no tooltip do horário.
 */
export function AuditEntry({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rows = changeRows(log.changes);
  const href = entityHref(log);
  const who = log.actor.name ?? ACTOR_KIND[log.actor.type];
  const { text, withItem } = actionPhrase(log);
  const name = withItem ? log.entityName : null;
  const technical = [log.action, log.ip && `IP ${log.ip}`].filter(Boolean).join(" · ");

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <ActorMark actor={log.actor} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-neutral-800">
            <span className="font-semibold text-neutral-900">{who}</span> {text}
            {name && (
              <>
                {" "}
                {href ? (
                  <Link
                    to={href}
                    className="font-semibold text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-900"
                  >
                    {name}
                  </Link>
                ) : (
                  <span className="font-semibold text-neutral-900">{name}</span>
                )}
              </>
            )}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            <time
              dateTime={log.createdAt}
              title={`${formatDateTime(log.createdAt)}${technical ? ` · ${technical}` : ""}`}
            >
              {formatRelative(log.createdAt)} · {formatDateTime(log.createdAt)}
            </time>
          </p>
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-xs text-neutral-600 transition hover:bg-neutral-900/[0.06] hover:text-neutral-900"
          >
            {open ? "Esconder" : "Ver o que mudou"}
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
          className="mt-3 grid gap-1.5 rounded-2xl bg-neutral-900/[0.03] p-3 text-sm sm:ml-13"
        >
          {rows.map((r) => (
            <div
              key={r.field}
              className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-[12rem_minmax(0,1fr)]"
            >
              <dt className="text-xs font-medium text-neutral-500 sm:pt-0.5">{r.label}</dt>
              <dd className="flex min-w-0 flex-wrap items-center gap-2 break-words">
                {r.kind === "diff" ? (
                  <>
                    <span className="rounded-md bg-red-50 px-1.5 text-red-700 line-through decoration-red-700/40">
                      <span className="sr-only">antes: </span>
                      {formatValue(r.from)}
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-neutral-400" aria-hidden />
                    <span className="rounded-md bg-green-50 px-1.5 text-green-700">
                      <span className="sr-only">depois: </span>
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
