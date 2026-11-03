import { qrCurrentSchema, ROUTES } from "@arp/contracts";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { apiRequest, errorMessage } from "@/shared/api";
import { Spinner } from "@/shared/ui";

/** Margem para o relógio do telão não pedir o código antes da API virar a janela. */
const REFRESH_SLACK_MS = 300;

/**
 * Telão: mostra o QR em tela cheia e troca sozinho quando o código vence.
 * O código anterior deixa de valer na API (foto ou print não serve).
 */
export function QrScreenPage() {
  const { id = "" } = useParams();
  const [now, setNow] = useState(Date.now());
  const current = useQuery({
    queryKey: ["qr-screen", id],
    queryFn: ({ signal }) =>
      apiRequest(ROUTES.qrCodes.current, qrCurrentSchema, { params: { id }, signal }),
    refetchOnWindowFocus: true,
  });
  const expiresAt = current.data ? new Date(current.data.expiresAt).getTime() : null;

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

  const left = expiresAt === null ? 0 : Math.max(0, Math.ceil((expiresAt - now) / 1000));
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f6f3ea] p-6 text-neutral-900">
      {current.isError ? (
        <p className="text-lg">{errorMessage(current.error)}</p>
      ) : !current.data ? (
        <Spinner />
      ) : (
        <div className="flex flex-col items-center gap-6">
          <div className="rounded-[2rem] bg-[#fff] p-6 shadow-sm">
            <QRCodeSVG
              value={current.data.payload}
              size={Math.min(
                560,
                Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.7),
              )}
              level="M"
              title="QR Code do desafio"
            />
          </div>
          <p className="text-2xl font-semibold">Aponte a câmera do app ARP</p>
          {current.data.rotating && (
            <p className="text-lg text-neutral-600" aria-live="polite">
              Este código muda em {formatLeft(left)}
            </p>
          )}
        </div>
      )}
    </main>
  );
}

function formatLeft(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}min ${String(s).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}min`;
}
