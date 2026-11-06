import type { Coupon, CouponLifecycle } from "@arp/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, CircleStop, Pause, Play, Send, Trash2, X } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "@/shared/api";
import { formatDateTime, plural } from "@/shared/lib/format";
import { Button, confirmar, toast } from "@/shared/ui";
import { couponKeys, couponsApi } from "../api";
import { claimsCount } from "./CouponActions";

type Kind = "publish" | "resume" | "pause" | "end" | "archive" | "remove";

const LIVE: CouponLifecycle[] = ["active", "scheduled", "soldout"];
const ELIGIBLE: Record<Kind, (c: Coupon) => boolean> = {
  publish: (c) => c.lifecycle === "draft",
  resume: (c) => c.lifecycle === "paused",
  pause: (c) => LIVE.includes(c.lifecycle),
  end: (c) => LIVE.includes(c.lifecycle) || c.lifecycle === "paused",
  // Agendada ainda não está no app: arquiva direto (fica pausada).
  archive: (c) => ["draft", "scheduled", "paused", "ended"].includes(c.lifecycle),
  // Excluir só o que nunca teve cupom pego (a API confere o resto).
  remove: (c) => claimsCount(c) === 0,
};

const names = (list: Coupon[]) => {
  const shown = list.slice(0, 4).map((c) => `“${c.title}”`);
  return list.length > 4 ? `${shown.join(", ")} e mais ${list.length - 4}` : shown.join(", ");
};

const future = (c: Coupon) => new Date(c.startsAt).getTime() > Date.now();

/**
 * Ações em massa da tabela (ciclo da Black Friday: criar rascunhos › publicar
 * › pausar/retomar › encerrar › arquivar ou excluir o que foi por engano).
 * Cada ação vale só para as selecionadas que a aceitam, com a contagem no
 * botão. Reversível tem "Desfazer"; publicar e encerrar confirmam; excluir
 * pede o número digitado.
 */
export function CouponBulkBar({ coupons, onDone }: { coupons: Coupon[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [running, setRunning] = useState<Kind | null>(null);
  const eligible = (kind: Kind) => coupons.filter(ELIGIBLE[kind]);

  /** Roda uma chamada por promoção; devolve as que deram certo e a primeira falha. */
  const runAll = async (list: Coupon[], call: (c: Coupon) => Promise<unknown>) => {
    const results = await Promise.allSettled(list.map(call));
    await qc.invalidateQueries({ queryKey: couponKeys.all });
    const ok = list.filter((_, i) => results[i]?.status === "fulfilled");
    const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    return { ok, failure: failed ? errorMessage(failed.reason) : null };
  };

  const report = (
    ok: Coupon[],
    failure: string | null,
    done: string,
    undo?: () => Promise<unknown>,
  ) => {
    const text = `${plural(ok.length, "promoção", "promoções")} ${done}.`;
    if (failure) toast.error(`${ok.length > 0 ? `${text} ` : ""}Algumas não mudaram: ${failure}`);
    else
      toast.success(
        text,
        undo ? { action: { label: "Desfazer", onClick: () => void undo() } } : undefined,
      );
  };

  const ask = (kind: Kind, list: Coupon[]): Promise<boolean> => {
    const n = list.length;
    const left = coupons.length - n;
    const skipped =
      left > 0 ? ` ${plural(left, "selecionada fica", "selecionadas ficam")} como está.` : "";
    if (kind === "publish") {
      const later = list.filter(future);
      const first = later.map((c) => c.startsAt).sort()[0];
      return confirmar({
        title: `${later.length === n ? "Agendar" : "Publicar"} ${plural(n, "promoção", "promoções")}?`,
        description: `${names(list)}. ${
          later.length === n
            ? `Ficam agendadas e entram no app a partir de ${formatDateTime(first ?? "")}.`
            : later.length > 0
              ? `${plural(n - later.length, "entra", "entram")} no app agora; ${plural(later.length, "fica agendada", "ficam agendadas")}.`
              : "Entram no app agora e os visitantes já podem pegar."
        } Dá para pausar depois.${skipped}`,
        confirmLabel: later.length === n ? `Agendar ${n}` : `Publicar ${n}`,
      });
    }
    if (kind === "end") {
      const waiting = list.reduce((s, c) => s + c.stock.waiting, 0);
      return confirmar({
        title: `Encerrar ${plural(n, "promoção", "promoções")}?`,
        description: `${names(list)}. Ninguém pega mais${
          waiting > 0
            ? `; ${plural(waiting, "cupom já pego continua", "cupons já pegos continuam")} valendo até o prazo de cada um`
            : ""
        }. Encerrada não volta ao ar.${skipped}`,
        confirmLabel: `Encerrar ${n}`,
        cancelLabel: "Manter no ar",
        danger: true,
      });
    }
    if (kind === "remove") {
      return confirmar({
        title: `Excluir ${plural(n, "promoção", "promoções")}?`,
        description: `${names(list)}. ${n === 1 ? "Ela some" : "Elas somem"} de vez do painel; isso não dá para desfazer.`,
        confirmLabel: `Excluir ${n}`,
        danger: true,
        confirmText: String(n),
      });
    }
    return Promise.resolve(true);
  };

  const act = async (kind: Kind) => {
    const list = eligible(kind);
    if (list.length === 0 || !(await ask(kind, list))) return;
    setRunning(kind);
    try {
      if (kind === "publish") {
        const r = await runAll(list, (c) => couponsApi.changeStatus(c.id, "active"));
        report(r.ok, r.failure, r.ok.every(future) ? "agendadas" : "publicadas");
      } else if (kind === "resume") {
        const r = await runAll(list, (c) => couponsApi.changeStatus(c.id, "active"));
        report(r.ok, r.failure, "de volta ao app", () =>
          runAll(r.ok, (c) => couponsApi.changeStatus(c.id, "paused")),
        );
      } else if (kind === "pause") {
        const r = await runAll(list, (c) => couponsApi.changeStatus(c.id, "paused"));
        report(r.ok, r.failure, "pausadas", () =>
          runAll(r.ok, (c) => couponsApi.changeStatus(c.id, "active")),
        );
      } else if (kind === "end") {
        const r = await runAll(list, (c) => couponsApi.changeStatus(c.id, "ended"));
        report(r.ok, r.failure, "encerradas");
      } else if (kind === "archive") {
        const r = await runAll(list, (c) => couponsApi.archive(c.id, true));
        // Desfazer: a agendada volta a ficar agendada (arquivar a deixou pausada).
        report(r.ok, r.failure, "arquivadas", () =>
          runAll(r.ok, async (c) => {
            await couponsApi.archive(c.id, false);
            if (c.lifecycle === "scheduled") await couponsApi.changeStatus(c.id, "active");
          }),
        );
      } else {
        const r = await runAll(list, (c) => couponsApi.remove(c.id));
        report(r.ok, r.failure, "excluídas");
      }
      onDone();
    } finally {
      setRunning(null);
    }
  };

  const button = (kind: Kind, label: string, icon: typeof Pause) => {
    const n = eligible(kind).length;
    // Só aparece o que vale para alguma das selecionadas (menos botão morto).
    if (n === 0) return null;
    return (
      <Button
        size="sm"
        variant="secondary"
        icon={icon}
        disabled={running !== null}
        loading={running === kind}
        onClick={() => void act(kind)}
        title={
          n !== coupons.length ? `Vale para ${n} das ${coupons.length} selecionadas` : undefined
        }
      >
        {label}
        {n !== coupons.length ? ` (${n})` : ""}
      </Button>
    );
  };

  const deletable = eligible("remove").length;
  const publishLabel = eligible("publish").every(future) ? "Agendar" : "Publicar";
  return (
    <div
      role="toolbar"
      aria-label="Ações nas promoções selecionadas"
      className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-neutral-900/[0.04] p-2 pl-4"
    >
      <span className="mr-auto text-sm font-medium text-neutral-800">
        {plural(coupons.length, "selecionada", "selecionadas")}
      </span>
      {button("publish", publishLabel, Send)}
      {button("resume", "Retomar", Play)}
      {button("pause", "Pausar", Pause)}
      {button("end", "Encerrar", CircleStop)}
      {button("archive", "Arquivar", Archive)}
      {deletable === coupons.length ? (
        <Button
          size="sm"
          variant="secondary"
          icon={Trash2}
          className="text-red-700 hover:text-red-800"
          disabled={running !== null}
          loading={running === "remove"}
          onClick={() => void act("remove")}
        >
          Excluir
        </Button>
      ) : (
        // Excluir em massa só quando todas podem: misturar apaga umas e deixa outras.
        <span className="text-xs text-neutral-500">
          {plural(coupons.length - deletable, "selecionada já teve", "selecionadas já tiveram")}{" "}
          cupom pego: arquive em vez de excluir
        </span>
      )}
      <Button size="sm" variant="ghost" icon={X} onClick={onDone} disabled={running !== null}>
        Limpar seleção
      </Button>
    </div>
  );
}
