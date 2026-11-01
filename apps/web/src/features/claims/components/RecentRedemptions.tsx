import type { CouponClaim } from "@arp/contracts";
import { History } from "lucide-react";
import { useCallback, useState } from "react";
import { z } from "zod";
import { formatTime } from "@/shared/lib/format";
import { Card, CardHeader } from "@/shared/ui";

// Últimos códigos validados nesta aba (some ao fechar). Só conveniência do
// caixa: o registro de verdade é a lista de cupons pegos.

const KEY = "arp:validados";
const MAX = 15;

const entrySchema = z.object({
  code: z.string(),
  couponTitle: z.string(),
  visitorName: z.string(),
  at: z.string(),
});
type Entry = z.infer<typeof entrySchema>;

function read(): Entry[] {
  try {
    const parsed = z.array(entrySchema).safeParse(JSON.parse(sessionStorage.getItem(KEY) ?? "[]"));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function write(list: Entry[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Armazenamento bloqueado (aba privativa): a lista vale só enquanto a tela está aberta.
  }
}

export function useRedeemedLog(): [Entry[], (claim: CouponClaim) => void] {
  const [list, setList] = useState<Entry[]>(read);
  const add = useCallback((claim: CouponClaim) => {
    setList((prev) => {
      const next = [
        {
          code: claim.code,
          couponTitle: claim.coupon.title,
          visitorName: claim.visitor.name,
          at: claim.redeemedAt ?? new Date().toISOString(),
        },
        ...prev.filter((e) => e.code !== claim.code),
      ].slice(0, MAX);
      write(next);
      return next;
    });
  }, []);
  return [list, add];
}

export function RecentRedemptions({ entries }: { entries: Entry[] }) {
  return (
    <Card>
      <CardHeader
        title="Validados agora"
        description="Nesta aba, desde que abriu."
        icon={History}
      />
      {entries.length === 0 ? (
        <p className="py-4 text-center text-sm text-neutral-500">Nenhum código validado ainda.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-neutral-900/[0.06]">
          {entries.map((e) => (
            <li key={e.code} className="flex items-center gap-3 py-2.5">
              <code className="rounded-lg bg-neutral-900/[0.06] px-2 py-1 font-mono text-xs font-semibold">
                {e.code}
              </code>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-neutral-800">{e.couponTitle}</span>
                <span className="block truncate text-xs text-neutral-500">{e.visitorName}</span>
              </span>
              <time dateTime={e.at} className="shrink-0 text-xs text-neutral-500 tabular-nums">
                {formatTime(e.at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
