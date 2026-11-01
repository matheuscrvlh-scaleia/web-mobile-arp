import type { QrCode } from "@arp/contracts";
import { Download } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { slugify } from "@/shared/lib/text";
import { Button, type ButtonProps } from "@/shared/ui";

const PNG_SIZE = 1024;

/**
 * Baixa o QR Code em PNG (1024 px, com margem branca). O canvas só existe
 * durante o download: desenha, vira arquivo e some.
 */
export function QrPngButton({
  qr,
  size = "sm",
  variant = "secondary",
}: {
  qr: Pick<QrCode, "payload" | "label">;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}) {
  const [rendering, setRendering] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  // Efeitos rodam de filho para pai: aqui o QR já foi desenhado no canvas.
  useEffect(() => {
    if (!rendering || !canvas.current) return;
    const link = document.createElement("a");
    link.href = canvas.current.toDataURL("image/png");
    link.download = `qr-${slugify(qr.label) || "selo"}.png`;
    link.click();
    setRendering(false);
  }, [rendering, qr.label]);

  return (
    <>
      <Button
        size={size}
        variant={variant}
        icon={Download}
        loading={rendering}
        onClick={() => setRendering(true)}
      >
        PNG<span className="sr-only"> do QR Code {qr.label}</span>
      </Button>
      {rendering && (
        <QRCodeCanvas
          ref={canvas}
          value={qr.payload}
          size={PNG_SIZE}
          marginSize={4}
          level="M"
          aria-hidden
          className="hidden"
        />
      )}
    </>
  );
}
