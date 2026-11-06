import type { Campaign, Challenge, QrCode } from "@arp/contracts";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Info, Printer } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "@/shared/api";
import { plural } from "@/shared/lib/format";
import { Button, Modal, PrintArea, Spinner } from "@/shared/ui";
import { challengeKeys, qrCodesApi } from "../api";
import { challengePeriod, formatDayMonth, type QrWeek, weeklyWindows } from "../lib/qr";
import { QrPoster } from "./QrPoster";

interface Poster {
  qr: QrCode;
  challenge: Challenge;
  week: number;
  last: boolean;
}

type Step =
  | { kind: "plan" }
  | { kind: "running"; done: number; total: number }
  | { kind: "ready"; posters: Poster[]; created: number; error?: string };

/** Mesmo instante, com folga de 1 min (a API guarda em ms; o form em minutos). */
const near = (iso: string | null, ms: number) =>
  iso !== null && Math.abs(new Date(iso).getTime() - ms) < 60_000;

/** QR fixo valendo que já cobre exatamente esta semana (gerar de novo não duplica). */
const findWeek = (list: QrCode[], w: QrWeek) =>
  list.find(
    (q) =>
      q.status === "active" &&
      !q.rotating &&
      near(q.validFrom, w.from) &&
      near(q.validUntil, w.until),
  );

/** "Árvore da praça · semana 2" → "Árvore da praça": o lugar do último cartaz. */
function baseLabel(list: QrCode[]): string {
  const last = [...list]
    .filter((q) => !q.rotating)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return last ? last.label.replace(/\s*·\s*semana \d+$/i, "").slice(0, 44) : "Cartaz";
}

const PREVIEW_SCALE = 0.32;

/**
 * "Gerar cartazes do mês": o QR impresso vale no máximo 7 dias (limite
 * antifraude da API, que não muda). Em vez de a pessoa gerar e imprimir toda
 * semana, cria de uma vez um QR por semana do período (01/12, 08/12…), cada
 * um começando quando o anterior vence, e imprime todos juntos, em ordem de
 * semana. Semana que já tem QR é reaproveitada, então gerar de novo só
 * reimprime.
 */
export function QrBatchModal({
  campaign,
  challenges,
  onClose,
}: {
  campaign: Campaign;
  /** Desafios de QR que entram (o chamador já filtrou ativos e da loja). */
  challenges: Challenge[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>({ kind: "plan" });
  const lists = useQueries({
    queries: challenges.map((c) => ({
      queryKey: challengeKeys.qrCodes(c.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => qrCodesApi.list(c.id, signal),
    })),
  });
  const loaded = lists.every((l) => l.data);
  const loadError = lists.find((l) => l.error)?.error;

  const plan = challenges.map((challenge, i) => {
    const existing = lists[i]?.data?.data ?? [];
    const { weeks, coversEnd } = weeklyWindows(challengePeriod({ campaign, challenge }));
    return { challenge, existing, weeks, coversEnd, base: baseLabel(existing) };
  });
  const total = plan.reduce((n, p) => n + p.weeks.length, 0);
  const reuse = plan.reduce((n, p) => n + p.weeks.filter((w) => findWeek(p.existing, w)).length, 0);
  // Semanas do calendário (iguais para quem segue o período da campanha).
  const calendar = [...new Map(plan.flatMap((p) => p.weeks).map((w) => [w.week, w])).values()].sort(
    (a, b) => a.week - b.week,
  );
  const partial = plan.filter((p) => p.weeks.length > 0 && !p.coversEnd);

  const run = async () => {
    const posters: Poster[] = [];
    let created = 0;
    let done = 0;
    setStep({ kind: "running", done, total });
    try {
      for (const p of plan) {
        for (const w of p.weeks) {
          let qr = findWeek(p.existing, w);
          if (!qr) {
            qr = await qrCodesApi.create(p.challenge.id, {
              label: `${p.base} · semana ${w.week}`,
              ttlSeconds: Math.round((w.until - w.from) / 1000),
              rotating: false,
              validFrom: new Date(w.from).toISOString(),
            });
            created++;
          }
          posters.push({ qr, challenge: p.challenge, week: w.week, last: w === p.weeks.at(-1) });
          setStep({ kind: "running", done: ++done, total });
        }
      }
      setStep({ kind: "ready", posters: sortPosters(posters), created });
    } catch (e) {
      // O que já foi gerado continua valendo e pode ser impresso.
      setStep({ kind: "ready", posters: sortPosters(posters), created, error: errorMessage(e) });
    } finally {
      void qc.invalidateQueries({ queryKey: challengeKeys.all });
    }
  };

  const running = step.kind === "running";
  const ready = step.kind === "ready" ? step : null;

  return (
    <Modal
      open
      onClose={onClose}
      busy={running}
      size="lg"
      title="Gerar cartazes do mês"
      description={
        challenges.length === 1
          ? `Desafio ${challenges[0]?.title}`
          : `${plural(challenges.length, "desafio de QR", "desafios de QR")} de ${campaign.name}`
      }
      footer={
        ready ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
            <Button
              icon={Printer}
              onClick={() => window.print()}
              disabled={ready.posters.length === 0}
            >
              Imprimir {plural(ready.posters.length, "cartaz", "cartazes")}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={running}>
              Cancelar
            </Button>
            <Button
              icon={CalendarRange}
              onClick={() => void run()}
              loading={running}
              disabled={!loaded || total === 0}
            >
              {total - reuse > 0
                ? `Gerar ${plural(total - reuse, "QR Code", "QR Codes")}`
                : "Abrir impressão"}
            </Button>
          </>
        )
      }
    >
      {ready ? (
        <Ready step={ready} />
      ) : loadError ? (
        <p className="text-sm text-red-700">{errorMessage(loadError)}</p>
      ) : !loaded ? (
        <div className="grid place-items-center py-10" aria-busy>
          <Spinner />
        </div>
      ) : total === 0 ? (
        <p className="text-sm text-neutral-700">
          O período {challenges.length === 1 ? "do desafio" : "da campanha"} já acabou: não há
          semana para cobrir.
        </p>
      ) : (
        <div className="flex flex-col gap-4 text-sm text-neutral-700">
          <p className="flex gap-2 rounded-2xl bg-neutral-900/[0.05] px-4 py-3">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              O QR impresso vale no máximo 7 dias, para uma foto do cartaz não dar selo para sempre.
              Aqui o painel já cria <strong>um QR por semana</strong>, cada um começando quando o
              anterior vence. Você imprime tudo agora e só troca o papel no dia escrito no cartaz.
            </span>
          </p>
          <ol aria-label="Semanas" className="flex flex-col gap-1.5">
            {calendar.map((w) => {
              const count = plan.filter((p) => p.weeks.some((x) => x.week === w.week)).length;
              return (
                <li
                  key={w.week}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-2xl border border-neutral-900/[0.06] px-4 py-2"
                >
                  <span>
                    <b className="font-semibold text-neutral-900">Semana {w.week}</b> · cole em{" "}
                    {formatDayMonth(w.from)}
                  </span>
                  <span className="text-neutral-500">
                    {plural(count, "cartaz", "cartazes")} · vale até {formatDayMonth(w.until - 1)}
                  </span>
                </li>
              );
            })}
          </ol>
          <p aria-live="polite">
            {step.kind === "running" ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" /> Gerando {step.done} de {step.total}…
              </span>
            ) : (
              <>
                Total: <strong>{plural(total, "cartaz", "cartazes")}</strong>
                {challenges.length > 1 && ` (${plural(challenges.length, "desafio", "desafios")})`}.
                {reuse > 0 &&
                  ` ${plural(reuse, "semana já tem QR e é reaproveitada", "semanas já têm QR e são reaproveitadas")}: nada se duplica.`}
              </>
            )}
          </p>
          {partial.length > 0 && (
            <p className="text-amber-800">
              Os cartazes cobrem até {formatDayMonth((partial[0]?.weeks.at(-1)?.until ?? 0) - 1)}.
              Depois disso, gere de novo.
            </p>
          )}
        </div>
      )}
      {ready && ready.posters.length > 0 && (
        <PrintArea>
          {ready.posters.map((p, i) => (
            <div
              key={p.qr.id}
              className={i < ready.posters.length - 1 ? "quebra-pagina" : undefined}
            >
              <QrPoster qr={p.qr} challenge={p.challenge} week={p.week} last={p.last} />
            </div>
          ))}
        </PrintArea>
      )}
    </Modal>
  );
}

/** Na ordem de colar: semana 1 de todos os desafios, depois a semana 2… */
const sortPosters = (list: Poster[]) =>
  [...list].sort((a, b) => a.week - b.week || a.challenge.sortOrder - b.challenge.sortOrder);

function Ready({ step }: { step: Extract<Step, { kind: "ready" }> }) {
  const first = step.posters[0];
  const weeks = [...new Set(step.posters.map((p) => p.week))];
  return (
    <div className="flex flex-col gap-4 text-sm text-neutral-700">
      {step.error && (
        <p role="alert" className="rounded-2xl bg-red-500/10 px-4 py-3 text-red-800">
          Parou no meio: {step.error} Os cartazes abaixo já valem; tente de novo para gerar o resto
          (o que já existe não se duplica).
        </p>
      )}
      <p aria-live="polite">
        <strong>{plural(step.posters.length, "cartaz pronto", "cartazes prontos")}</strong>
        {step.created < step.posters.length &&
          (step.created === 0
            ? " (todos os QR já existiam)"
            : ` (${plural(step.created, "QR novo", "QR novos")}; o resto já existia)`)}
        . Saem em ordem de semana: separe os de cada semana e troque no dia escrito em cima.
      </p>
      <ul className="flex flex-wrap gap-2" aria-label="Cartazes por semana">
        {weeks.map((w) => (
          <li key={w} className="rounded-full bg-neutral-900/[0.06] px-3 py-1">
            Semana {w}: {step.posters.filter((p) => p.week === w).length}
          </li>
        ))}
      </ul>
      {first && (
        <figure className="flex flex-col items-center gap-2 rounded-3xl bg-neutral-900/[0.05] p-4">
          <div
            aria-hidden
            className="overflow-hidden rounded-lg shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)]"
            style={{
              width: `calc(190mm * ${PREVIEW_SCALE})`,
              height: `calc(270mm * ${PREVIEW_SCALE})`,
            }}
          >
            <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: "top left" }}>
              <QrPoster
                qr={first.qr}
                challenge={first.challenge}
                week={first.week}
                last={first.last}
              />
            </div>
          </div>
          <figcaption className="text-xs text-neutral-500">
            Prévia do primeiro cartaz. Cada um sai numa folha A4.
          </figcaption>
        </figure>
      )}
    </div>
  );
}
