import type { Challenge, QrCode } from "@arp/contracts";
import { FileImage, Printer, StickyNote } from "lucide-react";
import { useState } from "react";
import { Button, Modal, PrintArea, Segmented } from "@/shared/ui";
import { QrPngButton } from "./QrPngButton";
import {
  LABELS_PER_SHEET,
  PRINT_SIZE,
  type PrintFormat,
  QrLabel,
  QrLabelSheet,
  QrPoster,
} from "./QrPoster";

const PREVIEW_SCALE: Record<PrintFormat, number> = { cartaz: 0.42, etiqueta: 1 };

/**
 * Imprimir o QR Code: escolhe cartaz (A4) ou etiquetas, vê a prévia e
 * imprime. Só o <PrintArea> sai no papel; o resto da página some.
 */
export function QrPrintModal({
  qr,
  challenge,
  onClose,
}: {
  qr: QrCode | null;
  challenge: Pick<Challenge, "title" | "seal" | "campaign">;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<PrintFormat>("cartaz");
  if (!qr) return null;
  const scale = PREVIEW_SCALE[format];
  const { w, h } = PRINT_SIZE[format];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Imprimir · ${qr.label}`}
      description="Pendure onde o desafio acontece. Cada pessoa ganha o selo uma vez."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          <QrPngButton qr={qr} size="md" />
          <Button icon={Printer} onClick={() => window.print()}>
            Imprimir
          </Button>
        </>
      }
    >
      <Segmented
        label="Formato"
        value={format}
        onChange={setFormat}
        options={[
          { value: "cartaz", label: "Cartaz A4", icon: FileImage },
          {
            value: "etiqueta",
            label: `Etiquetas (${LABELS_PER_SHEET} por folha)`,
            icon: StickyNote,
          },
        ]}
        className="mb-4"
      />
      <figure className="flex flex-col items-center gap-2 rounded-3xl bg-neutral-900/[0.05] p-4">
        <div
          aria-hidden
          className="overflow-hidden rounded-lg shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)]"
          style={{ width: `calc(${w}mm * ${scale})`, height: `calc(${h}mm * ${scale})` }}
        >
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
            {format === "cartaz" ? (
              <QrPoster qr={qr} challenge={challenge} />
            ) : (
              <QrLabel qr={qr} challenge={challenge} />
            )}
          </div>
        </div>
        <figcaption className="text-xs text-neutral-500">
          {format === "cartaz"
            ? "Prévia reduzida do cartaz A4."
            : `Tamanho real: 90 × 60 mm. Sai uma folha com ${LABELS_PER_SHEET} etiquetas para recortar.`}
        </figcaption>
      </figure>
      <PrintArea>
        {format === "cartaz" ? (
          <QrPoster qr={qr} challenge={challenge} />
        ) : (
          <QrLabelSheet qr={qr} challenge={challenge} />
        )}
      </PrintArea>
    </Modal>
  );
}
