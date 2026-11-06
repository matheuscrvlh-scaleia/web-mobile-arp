import { ChevronRight, CircleCheck, ListTodo } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/shared/lib/cn";
import { Card, CardHeader, ErrorState, Skeleton } from "@/shared/ui";
import { usePending } from "../api";
import { pendingView } from "../lib/pending";

/**
 * "O que preciso fazer agora": filas e alertas com link direto. Vazio vira
 * "Tudo em dia". Cor só para estado (âmbar = trava alguém).
 */
export function PendingCard() {
  const pending = usePending();
  const items = pending.data?.data ?? [];

  return (
    <Card>
      <CardHeader
        title="Pendências"
        description="O que precisa da sua atenção agora"
        icon={ListTodo}
      />
      {pending.error && !pending.data ? (
        <ErrorState error={pending.error} onRetry={() => void pending.refetch()} />
      ) : !pending.data ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <span className="sr-only">Carregando pendências…</span>
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          <CircleCheck className="size-5 shrink-0" aria-hidden />
          Tudo em dia ✓ Nada esperando por você.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {items.map((item) => {
            const v = pendingView(item);
            const Icon = v.icon;
            return (
              <li key={item.kind}>
                <Link
                  to={v.to}
                  className="group flex min-h-14 items-center gap-3 rounded-2xl bg-white/60 px-4 py-3 ring-1 ring-black/5 transition hover:bg-white hover:ring-black/10"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-xl",
                      v.urgent ? "bg-amber-100 text-amber-800" : "bg-neutral-100 text-neutral-600",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-neutral-900">{v.title}</span>
                    {v.detail && (
                      <span className="block truncate text-xs text-neutral-500">{v.detail}</span>
                    )}
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-700"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
