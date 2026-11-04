import type { DashboardDetailQuery, DashboardDetailTable, DetailColumnKind } from "@arp/contracts";
import { ArrowDown, ArrowUp, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { formatCents, formatIsoDay, formatNumber, formatPercent } from "@/shared/lib/format";
import {
  ButtonLink,
  type Column,
  CountPill,
  ErrorState,
  LoadingRegion,
  Modal,
  SearchInput,
  Skeleton,
  Table,
} from "@/shared/ui";
import { useDashboardDetail } from "../api";

// Modal "de onde vem este número" (como o modal-detalhe do copiloto): o
// número e a comparação, a fonte e a fórmula, e as linhas que o formam,
// pedidas à API só ao abrir (ou na pré-carga do cartão).

export interface KpiDetailInfo {
  label: string;
  value: string;
  previous?: string;
  deltaText?: string;
  /** Fonte, fórmula e regras do cartão, em linguagem de gente. */
  sources: { label: string; value: string }[];
  link?: { href: string; label: string };
}

type Cell = DashboardDetailTable["rows"][number]["cells"][number];

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatCell(v: Cell, kind: DetailColumnKind): string {
  if (v === null || v === "") return "—";
  if (typeof v === "number") {
    if (kind === "cents") return formatCents(v);
    if (kind === "percent") return formatPercent(v);
    return formatNumber(v);
  }
  if (kind === "day") return formatIsoDay(v, { withYear: true });
  if (kind === "month") {
    const [y, m] = v.split("-");
    return `${MONTHS[Number(m) - 1] ?? m}/${y}`;
  }
  return v;
}

const numeric = (k: DetailColumnKind) => k === "int" || k === "cents" || k === "percent";
const plain = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function DetailTable({ table, search }: { table: DashboardDetailTable; search: string }) {
  // Números começam do maior; texto e datas na ordem em que vieram.
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null);
  const term = plain(search.trim());
  const filtered = term
    ? table.rows.filter((r) =>
        plain(
          r.cells.map((c, i) => formatCell(c, table.columns[i]?.kind ?? "text")).join(" "),
        ).includes(term),
      )
    : table.rows;
  const rows = sort
    ? [...filtered].sort((a, b) => {
        const x = a.cells[sort.col] ?? null;
        const y = b.cells[sort.col] ?? null;
        if (x === null) return 1;
        if (y === null) return -1;
        const r =
          typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y), "pt-BR", { numeric: true });
        return r * sort.dir;
      })
    : filtered;

  const columns: Column<(typeof rows)[number]>[] = table.columns.map((c, i) => {
    const active = sort?.col === i;
    return {
      key: `${i}-${c.title}`,
      numeric: numeric(c.kind),
      header: (
        <button
          type="button"
          aria-label={`Ordenar por ${c.title}`}
          onClick={() =>
            setSort((s) =>
              s?.col === i
                ? { col: i, dir: s.dir === 1 ? -1 : 1 }
                : { col: i, dir: numeric(c.kind) ? -1 : 1 },
            )
          }
          className={`inline-flex cursor-pointer items-center gap-1 rounded-md transition hover:text-neutral-900 ${active ? "text-neutral-900" : ""}`}
        >
          {c.title}
          {active &&
            (sort?.dir === 1 ? (
              <ArrowUp className="size-3" aria-hidden />
            ) : (
              <ArrowDown className="size-3" aria-hidden />
            ))}
        </button>
      ),
      cell: (r) => formatCell(r.cells[i] ?? null, c.kind),
      className: i === 0 ? "font-medium" : undefined,
    };
  });

  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {table.title}
        <CountPill>{filtered.length}</CountPill>
      </h3>
      <Table
        caption={table.title}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        maxHeight="max-h-[24rem]"
        empty={
          <p className="py-6 text-center text-sm text-neutral-500">
            {term ? "Nada com esse nome." : "Nenhum registro no período."}
          </p>
        }
      />
    </section>
  );
}

export function KpiDetailModal({
  query,
  info,
  subtitle,
  onClose,
}: {
  query: DashboardDetailQuery | null;
  info: KpiDetailInfo | null;
  subtitle: string;
  onClose: () => void;
}) {
  const detail = useDashboardDetail(query);
  const [search, setSearch] = useState("");
  const data = detail.data;
  const total = data?.tables.reduce((s, t) => s + t.rows.length, 0) ?? 0;

  const summary = info
    ? [
        { label: "No período", value: info.value },
        ...(info.previous ? [{ label: "Período anterior", value: info.previous }] : []),
        ...(info.deltaText ? [{ label: "Variação", value: info.deltaText }] : []),
      ]
    : [];
  const sources = info
    ? [
        ...(data
          ? [
              {
                label: "Período",
                value: `${formatIsoDay(data.range.from, { withYear: true })} a ${formatIsoDay(data.range.to, { withYear: true })}, horário de Brasília`,
              },
              ...(info.previous
                ? [
                    {
                      label: "Comparado com",
                      value: `${formatIsoDay(data.range.previousFrom, { withYear: true })} a ${formatIsoDay(data.range.previousTo, { withYear: true })}`,
                    },
                  ]
                : []),
            ]
          : []),
        ...info.sources,
        { label: "Atualização", value: "A tela atualiza sozinha a cada minuto" },
      ]
    : [];

  return (
    <Modal
      open={query !== null && info !== null}
      onClose={() => {
        setSearch("");
        onClose();
      }}
      size="xl"
      title={
        <span className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-[0.2em] text-marca-escuro uppercase">
            De onde vem este número
          </span>
          <span className="text-2xl md:text-3xl">{info?.label}</span>
        </span>
      }
      description={subtitle}
      footer={
        info?.link && (
          <ButtonLink to={info.link.href} icon={ArrowUpRight}>
            {info.link.label}
          </ButtonLink>
        )
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {summary.map((r) => (
            <div key={r.label} className="rounded-2xl bg-neutral-900/[0.04] px-4 py-3">
              <dt className="text-[11px] text-neutral-500">{r.label}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">{r.value}</dd>
            </div>
          ))}
        </dl>

        <section className="rounded-2xl border border-neutral-900/[0.06] p-4">
          <h3 className="text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
            De onde vêm os dados
          </h3>
          <dl className="mt-2 grid gap-1.5 text-sm">
            {sources.map((f) => (
              <div key={f.label} className="leading-snug">
                <dt className="inline text-neutral-500">{f.label}: </dt>
                <dd className="inline">{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {total > 6 && (
          <SearchInput
            value={search}
            onChange={setSearch}
            label="Buscar nas linhas"
            placeholder="Buscar promoção, loja, desafio…"
          />
        )}

        {detail.error && !data ? (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} compact />
        ) : !data ? (
          <LoadingRegion label="Carregando as linhas…">
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="h-48 rounded-2xl" />
          </LoadingRegion>
        ) : (
          data.tables.map((t) => <DetailTable key={t.title} table={t} search={search} />)
        )}
      </div>
    </Modal>
  );
}
