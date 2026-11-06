import { type App, imageVariantUrl } from "@arp/contracts";

/*
 * Página pública do evento para compartilhar (Fase 2). O app manda o link no
 * WhatsApp; o WhatsApp lê as tags Open Graph e mostra a foto, o título e o
 * texto do evento na prévia. Quem abre no celular com o app vai para o evento
 * (arp://evento/<id>); sem o app, vê o resumo aqui mesmo.
 */

const SITE_URL = "https://www.espacoarp.com.br";

export function renderEventSharePage(event: App.EventDetail, origin: string): string {
  const image = absolute(imageVariantUrl(event.imageUrl, 960), origin);
  const when = whenLabel(event);
  const summary = `${when} · ${event.place} · ARP, Nova Friburgo`;
  const description = event.description ? `${summary}. ${event.description}` : summary;
  const appLink = `arp://evento/${event.id}`;
  const title = `${event.title} na ARP`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(truncate(description, 200))}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ARP">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(truncate(description, 200))}">
${image ? `<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:card" content="summary_large_image">` : ""}
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #f1ece7; color: #141714; }
  main { max-width: 480px; margin: 0 auto; padding: 24px 20px 40px; }
  img { width: 100%; border-radius: 24px; display: block; }
  h1 { font-size: 28px; letter-spacing: -0.02em; margin: 20px 0 6px; }
  p { color: #4a4f49; line-height: 1.5; }
  a.btn { display: block; text-align: center; background: #141714; color: #fff; text-decoration: none; padding: 16px; border-radius: 99px; font-weight: 700; margin-top: 12px; }
  a.soft { background: #e4ddd5; color: #141714; }
</style>
</head>
<body>
<main>
${image ? `<img src="${esc(image)}" alt="">` : ""}
<h1>${esc(event.title)}</h1>
<p><strong>${esc(when)}</strong> · ${esc(event.place)}</p>
${event.description ? `<p>${esc(event.description)}</p>` : ""}
<a class="btn" href="${esc(appLink)}">Abrir no app da ARP</a>
<a class="btn soft" href="${SITE_URL}">Ver o site da ARP</a>
</main>
</body>
</html>`;
}

function whenLabel(e: App.EventDetail): string {
  const time = e.startTime ? ` às ${e.startTime.replace(":00", "h").replace(":", "h")}` : "";
  const days = e.weekdays ?? (e.weekday === null ? [] : [e.weekday]);
  if (e.recurrence === "weekly" && days.length > 0) {
    const names = days.map((d) => WEEKDAYS[d]);
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0];
    return `Toda ${list}${time}`;
  }
  const day = e.nextDate ?? e.startsOn;
  if (e.endsOn && e.endsOn !== e.startsOn) return `${br(e.startsOn)} a ${br(e.endsOn)}${time}`;
  return `${br(day)}${time}`;
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function absolute(url: string | null, origin: string): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${origin}${url}` : url;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
