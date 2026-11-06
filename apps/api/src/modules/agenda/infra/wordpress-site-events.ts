import { ServiceUnavailableError } from "../../../shared/domain/errors";
import type { SiteEvent, SiteEventSource } from "../domain/repositories";

/** Site da ARP: posts do tipo "evento" (ACF) na API REST do WordPress. */
export const ARP_SITE_URL = "https://www.espacoarp.com.br";

const PER_PAGE = 100;
const MAX_PAGES = 50;
const TIMEOUT_MS = 20_000;

interface WpEvento {
  id: number;
  link: string;
  title: { rendered: string };
  featured_media: number;
  acf?: {
    evento_tipo?: string | null;
    evento_data_hora?: string | null;
    evento_data_hora_fim?: string | null;
    evento_datas?: string | null;
    evento_descricao?: string | null;
  } | null;
}

const NAMED: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
};

/** Texto do WordPress (HTML com entidades) em texto puro. */
function plain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] !== "#") return NAMED[e.toLowerCase()] ?? m;
      const hex = e[1]?.toLowerCase() === "x";
      return String.fromCodePoint(Number.parseInt(e.slice(hex ? 2 : 1), hex ? 16 : 10));
    })
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Onde acontece: a linha com 📍 ou o "na/no …" da primeira frase curta
 * ("Atração Musical na Serra Carioca" → "Serra Carioca"); senão "ARP".
 * atalho: heurística sobre texto livre; o gestor corrige no rascunho.
 */
export function placeOf(description: string): string {
  const pin = description.match(/📍\s*([^\n]+)/u)?.[1];
  const first = description.split("\n")[0] ?? "";
  const after =
    first.length <= 100 ? first.match(/\b(?:na|no|nas|nos)\s+([^.!?\n]+)/i)?.[1] : undefined;
  const place = oneLine((pin ?? after ?? "").replace(/\s+a partir d.*$/i, ""));
  return place.length >= 2 ? place.slice(0, 120) : "ARP";
}

const DATETIME = /(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/g;

/** 00:00 no site = sem horário informado. */
const timeOrNull = (t: string | undefined) => (t && t !== "00:00" ? t : null);

/**
 * Post do site no formato da agenda. "date": data/hora (e fim opcional);
 * "array": lista "início_fim". Mais de um dia vira período (range).
 * null = sem data legível ou título curto demais.
 */
export function siteEventFromPost(post: WpEvento, imageUrl: string | null): SiteEvent | null {
  const acf = post.acf ?? {};
  const raw =
    acf.evento_tipo === "array"
      ? (acf.evento_datas ?? "")
      : `${acf.evento_data_hora ?? ""} ${acf.evento_data_hora_fim ?? ""}`;
  const stamps = [...raw.matchAll(DATETIME)].map((m) => `${m[1]} ${m[2]}`).sort();
  const start = stamps[0]?.split(" ");
  const end = stamps.length > 1 ? stamps[stamps.length - 1]?.split(" ") : undefined;
  const title = oneLine(plain(post.title.rendered)).slice(0, 120);
  if (!start?.[0] || title.length < 3) return null;

  const [startsOn, startClock] = start;
  const multiDay = Boolean(end?.[0] && end[0] > startsOn);
  const description = plain(acf.evento_descricao ?? "").slice(0, 1200);
  return {
    siteId: post.id,
    siteUrl: post.link,
    event: {
      title,
      description,
      imageUrl,
      tone: null,
      icon: null,
      place: placeOf(description),
      floorId: null,
      storeId: null,
      recurrence: multiDay ? "range" : "single",
      startsOn,
      endsOn: multiDay ? (end?.[0] ?? null) : null,
      weekdays: null,
      startTime: timeOrNull(startClock),
      endTime: timeOrNull(startClock) ? timeOrNull(end?.[1]) : null,
      isLongRunning: false,
      awardsSeal: false,
    },
  };
}

/** Último dia do evento (para descartar os que já passaram). */
const lastDay = (e: SiteEvent) => e.event.endsOn ?? e.event.startsOn;

export class WordpressSiteEvents implements SiteEventSource {
  constructor(private readonly baseUrl: string = ARP_SITE_URL) {}

  async upcoming(today: string): Promise<{ events: SiteEvent[]; failed: number }> {
    const posts = await this.allPosts();
    const read = posts.map((p) => ({ post: p, event: siteEventFromPost(p, null) }));
    const upcoming = read.filter(
      (r): r is { post: WpEvento; event: SiteEvent } =>
        r.event !== null && lastDay(r.event) >= today,
    );
    const images = await this.imageUrls(upcoming.map((r) => r.post.featured_media));
    return {
      events: upcoming.map(({ post, event }) => ({
        ...event,
        event: { ...event.event, imageUrl: images.get(post.featured_media) ?? null },
      })),
      // Só conta como falha o que não deu para ler; passado é ignorado.
      failed: read.filter((r) => r.event === null).length,
    };
  }

  private async get(path: string): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/wp-json/wp/v2/${path}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new ServiceUnavailableError("O site da ARP não respondeu. Tente de novo em instantes.");
    }
    if (!res.ok) {
      throw new ServiceUnavailableError(`O site da ARP respondeu com erro (${res.status}).`);
    }
    return res;
  }

  private async page(n: number): Promise<{ posts: WpEvento[]; pages: number }> {
    const res = await this.get(
      `evento?per_page=${PER_PAGE}&page=${n}&_fields=id,link,title,featured_media,acf`,
    );
    const pages = Number(res.headers.get("x-wp-totalpages") ?? "1") || 1;
    return { posts: (await res.json()) as WpEvento[], pages };
  }

  private async allPosts(): Promise<WpEvento[]> {
    const first = await this.page(1);
    const rest = await Promise.all(
      Array.from({ length: Math.min(first.pages, MAX_PAGES) - 1 }, (_, i) => this.page(i + 2)),
    );
    return [first, ...rest].flatMap((p) => p.posts);
  }

  /** Foto de destaque de cada post (id da mídia → URL), em lotes de 100. */
  private async imageUrls(ids: number[]): Promise<Map<number, string>> {
    const unique = [...new Set(ids.filter((id) => id > 0))];
    const map = new Map<number, string>();
    for (let i = 0; i < unique.length; i += PER_PAGE) {
      const batch = unique.slice(i, i + PER_PAGE);
      const res = await this.get(
        `media?include=${batch.join(",")}&per_page=${PER_PAGE}&_fields=id,source_url`,
      );
      for (const m of (await res.json()) as { id: number; source_url?: string }[]) {
        if (m.source_url?.startsWith("https://")) map.set(m.id, m.source_url);
      }
    }
    return map;
  }
}
