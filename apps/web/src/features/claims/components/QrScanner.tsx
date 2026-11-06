import { CameraOff, QrCode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { Button, Modal } from "@/shared/ui";

// Leitura do QR pela câmera. Usa o BarcodeDetector do navegador (Chrome e
// Android); onde ele não existe (Safari do iPhone), o jsQR, baixado só ao
// abrir a câmera. Sem câmera, o botão nem aparece e fica a digitação.
// O QR do app traz só o código (ARP-XXXXXX).

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

/** Lê um quadro do vídeo; null = nenhum QR nele. */
type Decode = (video: HTMLVideoElement) => Promise<string | null>;

/** O navegador abre a câmera? (é o que basta: a leitura tem plano B) */
export const canScanQr = () => typeof navigator.mediaDevices?.getUserMedia === "function";

async function createDecoder(): Promise<Decode> {
  const Native = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (Native) {
    const detector = new Native({ formats: ["qr_code"] });
    return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    // Quadro reduzido (até 640px): rápido no celular e o QR ocupa boa parte.
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight, 1));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    if (!ctx || !w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    // attemptBoth: o app no modo escuro mostra o QR claro sobre escuro.
    const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, {
      inversionAttempts: "attemptBoth",
    });
    return found?.data ?? null;
  };
}

/** Botão "Ler QR" que abre a câmera traseira e devolve o texto lido. */
export function QrScanButton({
  onCode,
  className,
}: {
  onCode: (text: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!canScanQr()) return null;
  return (
    <>
      <Button
        variant="secondary"
        size="lg"
        icon={QrCode}
        onClick={() => setOpen(true)}
        className={className}
      >
        Ler QR
      </Button>
      {open && (
        <QrScannerModal
          onClose={() => setOpen(false)}
          onCode={(text) => {
            setOpen(false);
            onCode(text);
          }}
        />
      )}
    </>
  );
}

function QrScannerModal({
  onClose,
  onCode,
}: {
  onClose: () => void;
  onCode: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // O pai troca a função a cada render: o laço usa sempre a última.
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;
    // Começa a baixar o leitor junto com o pedido da câmera.
    const decoder = createDecoder();
    decoder.catch(() => {
      if (!stopped) setError("Não deu para carregar o leitor de QR. Digite o código.");
    });

    const tick = async () => {
      const video = videoRef.current;
      if (stopped || !video) return;
      if (video.readyState >= 2) {
        try {
          const text = (await (await decoder)(video))?.trim();
          if (text && !stopped) {
            stopped = true;
            onCodeRef.current(text);
            return;
          }
        } catch {
          // quadro ruim: tenta no próximo
        }
      }
      timer = window.setTimeout(tick, 200);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        if (stopped) {
          for (const t of s.getTracks()) t.stop();
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        void video.play().then(() => {
          setReady(true);
          void tick();
        });
      })
      .catch((e: unknown) => {
        const denied = e instanceof DOMException && e.name === "NotAllowedError";
        setError(
          denied
            ? "O navegador não deixou usar a câmera. Libere a câmera para este site ou digite o código."
            : "Não deu para abrir a câmera. Digite o código.",
        );
      });

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      for (const t of stream?.getTracks() ?? []) t.stop();
    };
  }, []);

  return (
    <Modal
      open
      onClose={onClose}
      title="Ler QR do cupom"
      description="Aponte para o QR que o visitante mostra no app."
      size="sm"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Digitar o código
        </Button>
      }
    >
      {error ? (
        <p className="flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
          <CameraOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-neutral-900">
          <video
            ref={videoRef}
            muted
            playsInline
            className={cn("size-full object-cover transition", !ready && "opacity-0")}
          />
          <span
            aria-hidden
            className="absolute inset-[18%] rounded-3xl border-4 border-[rgb(255_255_255/0.85)]"
          />
          {!ready && (
            <p className="absolute inset-0 grid place-items-center text-sm text-[#fff]">
              Abrindo a câmera…
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
