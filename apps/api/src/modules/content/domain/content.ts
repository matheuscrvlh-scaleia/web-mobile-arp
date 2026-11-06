import type { ArtPointKind } from "@arp/contracts";

/** Ponto do Circuito Cultural (cadastro simples). */
export interface ArtPointProps {
  id: string;
  number: number;
  name: string;
  artist: string;
  place: string;
  kind: ArtPointKind;
  description: string;
  imageUrl: string | null;
  mapX: number | null;
  mapY: number | null;
  active: boolean;
}

/** Item do Sustentarp (cadastro simples). */
export interface RecyclingItemProps {
  id: string;
  name: string;
  icon: string;
  accepts: string;
  rejects: string;
  becomes: string;
  givesSeal: boolean;
  sortOrder: number;
  active: boolean;
}

/** Vaga de emprego de uma loja. Encerrar antes do prazo = vencer agora (fica em "Encerradas"). */
export interface JobProps {
  id: string;
  storeId: string;
  title: string;
  text: string;
  imageUrl: string | null;
  whatsapp: string;
  expiresAt: Date;
  createdBy: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fim do prazo da vaga publicada agora. */
export function jobExpiry(now: Date, days: number): Date {
  return new Date(now.getTime() + days * DAY_MS);
}
