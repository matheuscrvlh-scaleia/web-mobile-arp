import { MAP_VIEWBOX, type MapShape, type MapShapeKind } from "@arp/contracts";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useId,
} from "react";
import { iconFor } from "@/shared/lib/icons";

// Desenho do andar no viewBox 360×470 do app do visitante, com o mesmo
// estilo (blocos brancos, praça com árvores, estacionamento listrado…).
// As cores vêm de --mapa-* (globals.css) e acompanham o tema.

export const VIEW_W = MAP_VIEWBOX.width;
export const VIEW_H = MAP_VIEWBOX.height;

export const SHAPE_KIND_LABEL: Record<MapShapeKind, string> = {
  block: "Bloco",
  plaza: "Praça",
  parking: "Estacionamento",
  bridge: "Passarela",
  void: "Vão",
  terrace: "Terraço",
};

export const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
/** Arredonda para a grade de 2 unidades (alinha sem precisar de precisão de pixel). */
export const snap = (v: number) => Math.round(v / 2) * 2;

/** Converte a posição do ponteiro na tela para coordenadas do desenho. */
export function useSvgPoint(svgRef: RefObject<SVGSVGElement | null>) {
  return useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      const ctm = svg?.getScreenCTM();
      if (!svg || !ctm) return null;
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return { x: p.x, y: p.y };
    },
    [svgRef],
  );
}

/** Ids dos padrões do quadro (únicos por mapa na página). */
const PatternIds = createContext({ parking: "" });

/** Quadro do mapa: fundo quadriculado e padrões; o conteúdo vem nos filhos. */
export function MapCanvas({
  ref,
  title,
  children,
  className,
  ...props
}: ComponentProps<"svg"> & {
  /** Nome do mapa para leitores de tela (ex.: "Mapa do 1º andar"). */
  title: string;
  children: ReactNode;
}) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      {...props}
    >
      <title>{title}</title>
      <defs>
        <pattern id={`grade-${uid}`} width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M14 0H0V14" fill="none" stroke="var(--mapa-grade)" strokeWidth=".7" />
        </pattern>
        <pattern
          id={`estacionamento-${uid}`}
          width="9"
          height="9"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="9" height="9" fill="var(--mapa-estac-1)" />
          <rect width="3" height="9" fill="var(--mapa-estac-2)" />
        </pattern>
      </defs>
      <rect width={VIEW_W} height={VIEW_H} fill="var(--mapa-fundo)" />
      <rect width={VIEW_W} height={VIEW_H} fill={`url(#grade-${uid})`} />
      <PatternIds.Provider value={{ parking: `estacionamento-${uid}` }}>
        {children}
      </PatternIds.Provider>
    </svg>
  );
}

/**
 * Planta do andar (foto ou PDF exportado em imagem) por baixo do desenho,
 * para decalcar os blocos. Só no painel: o app mostra o desenho.
 */
export function FloorPlanImage({ url, opacity }: { url: string; opacity: number }) {
  return (
    <image
      href={url}
      x={0}
      y={0}
      width={VIEW_W}
      height={VIEW_H}
      preserveAspectRatio="xMidYMid meet"
      opacity={opacity}
      pointerEvents="none"
    />
  );
}

const TREES = [
  [0.11, 0.3],
  [0.89, 0.3],
  [0.15, 0.78],
  [0.85, 0.78],
  [0.31, 0.5],
  [0.7, 0.53],
] as const;

/** Uma forma do desenho (bloco, praça, estacionamento, passarela, vão, terraço). */
export function MapShapeView({ shape }: { shape: MapShape }) {
  const { x, y, w, h, label } = shape;
  const patterns = useContext(PatternIds);
  const text = label.toUpperCase();
  switch (shape.kind) {
    case "plaza":
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={Math.min(34, h / 2)}
            fill="var(--mapa-praca)"
          />
          {w > 80 &&
            h > 40 &&
            TREES.map(([fx, fy]) => (
              <g key={`${fx}-${fy}`}>
                <circle cx={x + fx * w} cy={y + fy * h} r="7" fill="var(--mapa-arvore)" />
                <circle
                  cx={x + fx * w - 2}
                  cy={y + fy * h - 2}
                  r="3"
                  fill="var(--mapa-arvore-brilho)"
                />
              </g>
            ))}
          <ShapeLabel x={x + w / 2} y={y + 16} anchor="middle" fill="var(--mapa-verde)">
            {text}
          </ShapeLabel>
        </g>
      );
    case "parking":
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx="16"
            fill={`url(#${patterns.parking})`}
            stroke="var(--mapa-estac-borda)"
          />
          <ShapeLabel x={x + 14} y={y + 22} fill="var(--mapa-estac-rotulo)">
            {text}
          </ShapeLabel>
        </g>
      );
    case "bridge":
      return (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx="4"
          fill="var(--mapa-bloco)"
          stroke="var(--mapa-bloco-borda)"
          strokeDasharray="3 3"
        />
      );
    case "void":
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={Math.min(28, h / 2)}
            fill="none"
            stroke="var(--mapa-vao)"
            strokeWidth="1.4"
            strokeDasharray="5 5"
          />
          <ShapeLabel
            x={x + w / 2}
            y={y + h - 9}
            anchor="middle"
            size={8}
            fill="var(--mapa-vao-rotulo)"
          >
            {text}
          </ShapeLabel>
        </g>
      );
    case "terrace":
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx="18"
            fill="var(--mapa-terraco)"
            stroke="var(--mapa-terraco-borda)"
            strokeWidth="1.4"
            strokeDasharray="6 5"
          />
          <ShapeLabel x={x + 14} y={y + 24} fill="var(--mapa-verde)">
            {text}
          </ShapeLabel>
        </g>
      );
    default:
      return (
        <g>
          <rect x={x} y={y + 4} width={w} height={h} rx="18" fill="var(--mapa-bloco-sombra)" />
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx="18"
            fill="var(--mapa-bloco)"
            stroke="var(--mapa-bloco-borda)"
            strokeWidth="1.2"
          />
          <ShapeLabel x={x + 14} y={y + 24} fill="var(--mapa-rotulo)">
            {text}
          </ShapeLabel>
        </g>
      );
  }
}

function ShapeLabel({
  x,
  y,
  anchor = "start",
  size = 9,
  fill,
  children,
}: {
  x: number;
  y: number;
  anchor?: "start" | "middle";
  size?: number;
  fill: string;
  children: string;
}) {
  if (!children) return null;
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontWeight="700"
      letterSpacing=".7"
      fill={fill}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      {children}
    </text>
  );
}

/** Pino de loja: círculo na cor da marca com o ícone; selecionado ganha pulso e nome. */
export function StorePinMark({
  x,
  y,
  color,
  icon,
  name,
  selected = false,
  dimmed = false,
  children,
  ...props
}: Omit<ComponentProps<"g">, "x" | "y"> & {
  x: number;
  y: number;
  color: string;
  icon: string;
  name: string;
  selected?: boolean;
  dimmed?: boolean;
}) {
  const Icon = iconFor(icon);
  const r = selected ? 17 : 14;
  const labelW = Math.min(name.length * 6.4 + 22, 200);
  return (
    <g transform={`translate(${x} ${y})`} opacity={dimmed ? 0.35 : 1} {...props}>
      {selected && <circle className="mapa-pulso" r="14" fill={color} />}
      <circle r={r + 2.5} fill="#fff" />
      <circle r={r} fill={color} />
      <Icon x={-7} y={-7} width={14} height={14} color="#fff" strokeWidth={2.25} aria-hidden />
      {selected && (
        <g transform="translate(0 -34)" style={{ pointerEvents: "none" }}>
          <rect
            x={-labelW / 2}
            y="-13"
            width={labelW}
            height="26"
            rx="13"
            fill="var(--mapa-tinta)"
          />
          <text y="4.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">
            {name}
          </text>
          <path d="M-5 12 L0 18 L5 12Z" fill="var(--mapa-tinta)" />
        </g>
      )}
      {children}
    </g>
  );
}

/** Ponto de referência (reciclagem, início do tour…): quadrado de tinta com o ícone. */
export function MapPointMark({
  x,
  y,
  icon,
  selected = false,
  children,
  ...props
}: Omit<ComponentProps<"g">, "x" | "y"> & {
  x: number;
  y: number;
  icon: string;
  selected?: boolean;
}) {
  const Icon = iconFor(icon);
  return (
    <g transform={`translate(${x} ${y})`} {...props}>
      {selected && (
        <rect
          x="-17"
          y="-17"
          width="34"
          height="34"
          rx="11"
          fill="none"
          stroke="var(--color-marca)"
          strokeWidth="2.5"
        />
      )}
      <rect x="-12" y="-12" width="24" height="24" rx="8" fill="var(--mapa-tinta)" />
      <Icon x={-6.5} y={-6.5} width={13} height={13} color="#fff" strokeWidth={2.25} aria-hidden />
      {children}
    </g>
  );
}
