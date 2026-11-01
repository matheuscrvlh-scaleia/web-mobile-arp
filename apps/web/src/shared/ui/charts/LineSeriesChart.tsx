import { Table2 } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/shared/lib/format";
import { ChartLegend, ChartTooltipBox } from "./ChartParts";
import { type SeriesDef, seriesColor } from "./series";

type Row = Record<string, string | number>;

/**
 * Linhas no tempo (várias séries, um eixo só). Passar o mouse mostra a
 * linha-guia e a dica com todas as séries daquele ponto; pelo teclado, o
 * gráfico recebe foco e as setas andam (accessibilityLayer do recharts).
 * Os números exatos ficam também na tabela de "Ver em tabela".
 */
export function LineSeriesChart<T extends Row>({
  data,
  xKey,
  series,
  formatX,
  formatTitle,
  formatValue = (v) => formatNumber(v),
  height = 260,
  description,
}: {
  data: T[];
  xKey: keyof T & string;
  series: SeriesDef<keyof T & string>[];
  /** Rótulo curto do eixo X (ex.: "31/10"). */
  formatX: (x: T[keyof T & string]) => string;
  /** Título da dica e da linha da tabela (ex.: "sex, 31 out"). */
  formatTitle?: (x: T[keyof T & string]) => string;
  formatValue?: (v: number) => string;
  height?: number;
  /** O que o gráfico mostra, para leitores de tela. */
  description: string;
}) {
  const title = formatTitle ?? formatX;
  return (
    <figure className="flex flex-col gap-3">
      <ChartLegend series={series} />
      <div style={{ height }} role="img" aria-label={description}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 4"
              stroke="var(--color-neutral-200)"
            />
            <XAxis
              dataKey={(row: T) => row[xKey]}
              tickFormatter={(v: T[keyof T & string]) => formatX(v)}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--color-neutral-500)", fontSize: 11 }}
              minTickGap={24}
              tickMargin={8}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              width={44}
              tick={{ fill: "var(--color-neutral-500)", fontSize: 11 }}
              tickFormatter={(v: number) => formatValue(v)}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-neutral-400)", strokeDasharray: "3 3" }}
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const row = payload[0]?.payload as T | undefined;
                return (
                  <ChartTooltipBox
                    title={row ? title(row[xKey]) : String(label ?? "")}
                    rows={series.map((s) => ({
                      key: s.key,
                      label: s.label,
                      color: s.color,
                      value: formatValue(Number(row?.[s.key] ?? 0)),
                    }))}
                  />
                );
              }}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={seriesColor(s.color)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--color-white)" }}
                animationDuration={600}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="group text-sm">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-900/[0.05] hover:text-neutral-900">
          <Table2 className="size-3.5" aria-hidden />
          <span className="group-open:hidden">Ver em tabela</span>
          <span className="hidden group-open:inline">Esconder tabela</span>
        </summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full min-w-max text-xs">
            <caption className="sr-only">{description}</caption>
            <thead className="sticky top-0 bg-white/90 backdrop-blur">
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th scope="col" className="px-2 py-1.5 text-left font-medium">
                  Data
                </th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="px-2 py-1.5 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={String(row[xKey])} className="border-b border-neutral-900/[0.05]">
                  <th scope="row" className="px-2 py-1.5 text-left font-normal text-neutral-600">
                    {title(row[xKey])}
                  </th>
                  {series.map((s) => (
                    <td key={s.key} className="px-2 py-1.5 text-right tabular-nums">
                      {formatValue(Number(row[s.key] ?? 0))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
