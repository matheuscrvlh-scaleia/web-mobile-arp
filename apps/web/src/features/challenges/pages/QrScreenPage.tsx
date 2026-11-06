import { type QrBlocked, qrCurrentSchema, ROUTES } from "@arp/contracts";
import { useQuery } from "@tanstack/react-query";
import { Maximize, Minimize } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { SealBadge } from "@/features/seals";
import { ApiError, apiRequest, errorMessage } from "@/shared/api";
import { formatDateTime } from "@/shared/lib/format";
import { Spinner } from "@/shared/ui";

const BLOCKED_TEXT: Record<QrBlocked, (startsAt: string) => string> = {
  paused: () => "Ainda não dá selo: o desafio está pausado no painel.",
  unpublished: () => "Ainda não dá selo: a campanha não está publicada.",
  not_started: (startsAt) => `Ainda não dá selo: o desafio começa em ${formatDateTime(startsAt)}.`,
  ended: () => "Não dá mais selo: o desafio já acabou.",
};

/** Margem para o relógio do telão não pedir o código antes da API virar a janela. */
const REFRESH_SLACK_MS = 300;
/** O botão de tela cheia some depois de um tempo parado (não aparece na TV). */
const CONTROLS_IDLE_MS = 3000;
/** Contagem só é anunciada no fim (leitor de tela não fala a cada segundo). */
const ANNOUNCE_BELOW_S = 5;

/**
 * Telão: mostra o QR grande, com o desafio, o selo e a campanha, e troca
 * sozinho quando o código vence. O código anterior deixa de valer na API
 * (foto ou print não serve). Erro de rede tenta de novo sozinho.
 */
export function QrScreenPage() {
  const { id = "" } = useParams();
  const [now, setNow] = useState(Date.now());
  const current = useQuery({
    queryKey: ["qr-screen", id],
    queryFn: ({ signal }) =>
      apiRequest(ROUTES.qrCodes.current, qrCurrentSchema, { params: { id }, signal }),
    refetchOnWindowFocus: true,
    // A TV fica ligada o dia todo: queda de rede ou da API não pode matar a tela.
    retry: (count, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && count < 3,
    retryDelay: (n) => Math.min(30_000, 2000 * 2 ** n),
  });
  const expiresAt = current.data ? new Date(current.data.expiresAt).getTime() : null;
  const fullscreen = useFullscreen();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const { refetch } = current;
  useEffect(() => {
    if (expiresAt === null) return;
    const timer = setTimeout(
      () => void refetch(),
      Math.max(0, expiresAt - Date.now()) + REFRESH_SLACK_MS,
    );
    return () => clearTimeout(timer);
  }, [expiresAt, refetch]);

  // Sem código (erro): tenta de novo a cada 30 s, até a rede ou a API voltarem.
  useEffect(() => {
    if (!current.isError) return;
    const timer = setInterval(() => void refetch(), 30_000);
    return () => clearInterval(timer);
  }, [current.isError, refetch]);

  const left = expiresAt === null ? 0 : Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const data = current.data;
  // O QR ocupa o espaço que sobra entre o cabeçalho e o rodapé: nada abaixo da dobra (1366×768).
  const [area, setArea] = useState<HTMLDivElement | null>(null);
  const box = useBoxSize(area);
  const size = Math.max(160, Math.min(560, box.h - QR_PADDING, box.w - QR_PADDING));

  return (
    <main
      className={`relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-[#f6f3ea] p-6 text-neutral-900 ${fullscreen.idle ? "cursor-none" : ""}`}
      onPointerMove={fullscreen.wake}
    >
      {fullscreen.supported && (
        <button
          type="button"
          onClick={fullscreen.toggle}
          className={`absolute top-4 right-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-neutral-900 px-4 text-sm font-medium text-white transition-opacity focus-visible:opacity-100 ${fullscreen.idle ? "opacity-0" : "opacity-100"}`}
        >
          {fullscreen.active ? (
            <Minimize className="size-4" aria-hidden />
          ) : (
            <Maximize className="size-4" aria-hidden />
          )}
          {fullscreen.active ? "Sair da tela cheia" : "Tela cheia"}
        </button>
      )}
      {current.isError && !data ? (
        <ScreenMessage error={current.error} retrying={current.isFetching} />
      ) : !data ? (
        <Spinner />
      ) : data.status === "revoked" ? (
        <ScreenMessage
          title="Este QR Code foi revogado"
          description="Ele não dá mais selo. Gere outro QR Code no painel (Desafios › QR Codes)."
        />
      ) : (
        <div className="flex min-h-0 w-full max-w-5xl flex-1 flex-col items-center gap-4 text-center">
          <p className="rounded-full bg-[#e7f6ea] px-4 py-1.5 text-base font-semibold text-[#2f7d3d]">
            {data.campaign.name}
          </p>
          <div className="flex items-center gap-4">
            <SealBadge seal={data.seal} size={72} />
            <div className="text-left">
              <p className="text-lg font-semibold text-[#2f7d3d]">Ganhe o selo {data.seal.name}</p>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                {data.challenge.title}
              </h1>
            </div>
          </div>
          {/* Para quem monta o telão: o código aparece, mas ainda não dá selo (acima do QR, sempre visível). */}
          {data.blocked && (
            <p className="rounded-2xl bg-amber-500/20 px-4 py-2 text-lg text-amber-950">
              {BLOCKED_TEXT[data.blocked](data.startsAt)}
            </p>
          )}
          <div ref={setArea} className="flex min-h-0 w-full flex-1 items-center justify-center">
            <div className="rounded-[2rem] bg-[#fff] p-6 shadow-sm">
              <QRCodeSVG
                value={data.payload}
                size={size}
                level="M"
                title={`QR Code do desafio ${data.challenge.title}`}
              />
            </div>
          </div>
          <p className="text-2xl font-semibold">Abra o app ARP › Selos › Ler QR Code</p>
          {data.rotating && (
            <>
              <p className="text-lg text-neutral-600">
                Este código muda em <span className="tabular-nums">{formatLeft(left)}</span>
              </p>
              <p aria-live="polite" className="sr-only">
                {left > 0 && left <= ANNOUNCE_BELOW_S ? `O código muda em ${left} segundos` : ""}
              </p>
            </>
          )}
          {/* Erro de rede com um código ainda na tela: avisa, mas não some. */}
          {current.isError && (
            <p className="rounded-full bg-amber-500/20 px-4 py-1.5 text-base text-amber-950">
              Sem conexão com o painel. Tentando de novo…
            </p>
          )}
        </div>
      )}
    </main>
  );
}

/** Mensagem grande, para ler de longe na TV. */
function ScreenMessage({
  error,
  retrying,
  title,
  description,
}: {
  error?: unknown;
  retrying?: boolean;
  title?: string;
  description?: string;
}) {
  const status = error instanceof ApiError ? error.status : null;
  const text =
    title !== undefined
      ? { title, description }
      : status === 401
        ? {
            title: "Sessão expirada",
            description: "Peça para alguém da equipe entrar de novo no painel neste aparelho.",
          }
        : status === 403
          ? {
              title: "Esta conta não pode abrir o telão",
              description:
                "Entre com uma conta que gera QR Codes (equipe ARP ou o lojista do desafio).",
            }
          : status === 404
            ? {
                title: "QR Code não encontrado",
                description:
                  "Ele pode ter sido excluído junto com o desafio. Gere outro no painel.",
              }
            : {
                title: "Sem conexão com o painel",
                description: retrying
                  ? "Tentando de novo…"
                  : `O telão tenta de novo sozinho a cada 30 segundos. (${errorMessage(error)})`,
              };
  return (
    <div role="alert" className="flex max-w-3xl flex-col items-center gap-4 text-center">
      <p className="text-4xl font-extrabold tracking-tight sm:text-5xl">{text.title}</p>
      {text.description && <p className="text-2xl text-neutral-600">{text.description}</p>}
    </div>
  );
}

/** Folga do cartão branco em volta do QR (p-6 dos dois lados). */
const QR_PADDING = 48;

/** Largura e altura do elemento, atualizadas quando a janela muda (TV, notebook, giro do tablet). */
function useBoxSize(el: HTMLElement | null): { w: number; h: number } {
  const [box, setBox] = useState({ w: 560 + QR_PADDING, h: 560 + QR_PADDING });
  useEffect(() => {
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return box;
}

/** Tela cheia (Fullscreen API) e o botão que some quando ninguém mexe. */
function useFullscreen() {
  const supported = typeof document !== "undefined" && document.fullscreenEnabled;
  const [active, setActive] = useState(() => Boolean(document.fullscreenElement));
  const [idle, setIdle] = useState(false);
  const [poke, setPoke] = useState(0);

  useEffect(() => {
    const onChange = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `poke` reinicia a contagem a cada movimento
  useEffect(() => {
    setIdle(false);
    const timer = setTimeout(() => setIdle(true), CONTROLS_IDLE_MS);
    return () => clearTimeout(timer);
  }, [poke]);

  return {
    supported,
    active,
    idle,
    wake: () => setPoke((n) => n + 1),
    toggle: () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen().catch(() => undefined);
    },
  };
}

function formatLeft(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}min ${String(s).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}min`;
}
