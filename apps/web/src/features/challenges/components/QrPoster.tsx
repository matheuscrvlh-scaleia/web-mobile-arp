import type { Challenge, QrCode } from "@arp/contracts";
import { QRCodeSVG } from "qrcode.react";
import { SealBadge } from "@/features/seals";
import { qrWindowText } from "../lib/qr";

// Cartaz e etiqueta do QR Code, em milímetros (é o que sai no papel).
// Cores fixas: impressão não segue o tema do painel.

export type PrintFormat = "cartaz" | "etiqueta";

/** Etiquetas por folha A4 (2 colunas × 4 linhas, com linha de corte). */
export const LABELS_PER_SHEET = 8;

export const PRINT_SIZE: Record<PrintFormat, { w: number; h: number }> = {
  cartaz: { w: 190, h: 270 },
  etiqueta: { w: 90, h: 60 },
};

interface PrintProps {
  qr: QrCode;
  challenge: Pick<Challenge, "title" | "seal" | "campaign">;
}

const INK = "#141714";
const GREEN = "#2f7d3d";
const STEPS = [
  "Abra o app ARP",
  "Toque em Selos › Ler QR Code",
  "Aponte a câmera para este código",
];

/** Cartaz A4 para pendurar onde o desafio acontece. */
export function QrPoster({ qr, challenge }: PrintProps) {
  return (
    <div
      className="flex flex-col items-center bg-[#fff] text-center"
      style={{ width: "190mm", height: "270mm", padding: "12mm", color: INK }}
    >
      <div className="flex w-full items-center justify-between">
        <span className="flex items-center" style={{ gap: "3mm" }}>
          <img
            src="/brand/logo.png"
            alt=""
            style={{ width: "14mm", height: "14mm", borderRadius: "3mm" }}
          />
          <span className="text-left leading-tight">
            <b className="block" style={{ fontSize: "6mm" }}>
              ARP
            </b>
            <span style={{ fontSize: "3.6mm", color: "#5f5a54" }}>Desafios de selos</span>
          </span>
        </span>
        <span
          className="rounded-full font-semibold"
          style={{ fontSize: "3.6mm", padding: "1.5mm 4mm", background: "#e7f6ea", color: GREEN }}
        >
          {challenge.campaign.name}
        </span>
      </div>

      <div style={{ marginTop: "10mm" }}>
        <SealBadge seal={challenge.seal} size={110} />
      </div>
      <p className="font-semibold" style={{ marginTop: "5mm", fontSize: "5mm", color: GREEN }}>
        Ganhe o selo {challenge.seal.name}
      </p>
      <h1
        className="font-extrabold"
        style={{ marginTop: "2mm", fontSize: "11mm", lineHeight: 1.05, letterSpacing: "-0.03em" }}
      >
        {challenge.title}
      </h1>

      <div
        style={{
          marginTop: "8mm",
          padding: "5mm",
          borderRadius: "6mm",
          border: `0.6mm solid ${INK}`,
        }}
      >
        <QRCodeSVG
          value={qr.payload}
          size={512}
          level="M"
          fgColor={INK}
          bgColor="#ffffff"
          style={{ width: "92mm", height: "92mm", display: "block" }}
        />
      </div>
      <p style={{ marginTop: "3mm", fontSize: "3.4mm", color: "#77716a" }}>{qr.label}</p>

      <ol className="flex w-full justify-center text-left" style={{ marginTop: "8mm", gap: "6mm" }}>
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center" style={{ gap: "2.5mm", maxWidth: "52mm" }}>
            <span
              className="grid shrink-0 place-items-center rounded-full font-bold"
              style={{
                width: "8mm",
                height: "8mm",
                background: INK,
                color: "#fff",
                fontSize: "4mm",
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: "4mm", lineHeight: 1.2 }}>{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-auto" style={{ fontSize: "3.2mm", color: "#77716a" }}>
        Vale uma vez por pessoa · {qrWindowText(qr)}
      </p>
    </div>
  );
}

/** Etiqueta pequena (90 × 60 mm) para balcão, mesa ou totem. */
export function QrLabel({ qr, challenge }: PrintProps) {
  return (
    <div
      className="flex items-center bg-[#fff]"
      style={{ width: "90mm", height: "60mm", padding: "4mm", gap: "4mm", color: INK }}
    >
      <QRCodeSVG
        value={qr.payload}
        size={256}
        level="M"
        fgColor={INK}
        bgColor="#ffffff"
        style={{ width: "44mm", height: "44mm", display: "block", flexShrink: 0 }}
      />
      <div className="flex min-w-0 flex-col self-stretch">
        <span className="flex items-center" style={{ gap: "2mm" }}>
          <img
            src="/brand/logo.png"
            alt=""
            style={{ width: "7mm", height: "7mm", borderRadius: "1.5mm" }}
          />
          <SealBadge seal={challenge.seal} size={26} />
        </span>
        <b style={{ marginTop: "2.5mm", fontSize: "4.2mm", lineHeight: 1.1 }}>{challenge.title}</b>
        <span style={{ marginTop: "1mm", fontSize: "3mm", color: GREEN, fontWeight: 600 }}>
          Selo {challenge.seal.name}
        </span>
        <span className="mt-auto" style={{ fontSize: "2.8mm", lineHeight: 1.25, color: "#5f5a54" }}>
          Abra o app ARP › Selos › Ler QR Code
        </span>
      </div>
    </div>
  );
}

/** Folha A4 com várias etiquetas iguais e linha de corte tracejada. */
export function QrLabelSheet(props: PrintProps) {
  return (
    <div className="grid grid-cols-2" style={{ width: "180mm" }}>
      {Array.from({ length: LABELS_PER_SHEET }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: cópias idênticas da mesma etiqueta
          key={i}
          style={{ border: "0.2mm dashed #b0aaa3" }}
        >
          <QrLabel {...props} />
        </div>
      ))}
    </div>
  );
}
