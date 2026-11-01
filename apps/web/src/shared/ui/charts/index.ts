// Gráficos leves (sem dependência). O de linhas usa o recharts e é importado
// pelo caminho: "@/shared/ui/charts/LineSeriesChart" — só a tela que usa baixa a lib.
export { BarList, type BarListItem, ProportionBar, type ProportionSegment } from "./BarList";
export { ChartLegend, ChartTooltipBox } from "./ChartParts";
export { HourBars } from "./HourBars";
export { type SeriesColor, type SeriesDef, seriesColor } from "./series";
