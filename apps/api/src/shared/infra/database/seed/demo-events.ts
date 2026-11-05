import { addDaysToDate, toLocal } from "../../../domain/time";
import type { Database } from "../database";
import { type SqlFragment, sql } from "../sql";
import { DAY_MS, type DemoClock } from "./demo-time";
import type { Random } from "./random";

/*
 * Eventos fictícios de demonstração (is_demo): agenda cheia nesta semana e no
 * mês, com recorrentes, faixas longas, um encerrado e um rascunho, e
 * "Tenho interesse" dos visitantes fictícios.
 */

type Tone = "green" | "ink" | "clay" | "sand" | "deep";

interface EventTemplate {
  title: string;
  category: string;
  description: string;
  icon: string;
  tone: Tone;
  place: string;
  /** single: dia (offset de hoje); range: primeiro e último dia; weekly: dia da semana. */
  when:
    | { single: number }
    | { range: [number, number] }
    | { weekly: number; from: number; until: number | null };
  time: [string, string] | null;
  longRunning?: boolean;
  status?: "published" | "draft";
  /** Interessados (visitantes fictícios). */
  interest: number;
}

const EVENTS: EventTemplate[] = [
  {
    title: "Música ao vivo na praça",
    category: "Música",
    description:
      "Voz e violão no fim de tarde, com repertório de MPB e pop nacional. Entrada livre.",
    icon: "music",
    tone: "green",
    place: "Praça central",
    when: { weekly: 6, from: -60, until: null },
    time: ["17:00", "20:00"],
    interest: 46,
  },
  {
    title: "Feira de produtores da serra",
    category: "Gastronomia",
    description: "Queijos, cafés, pães e hortaliças de produtores de Nova Friburgo e região.",
    icon: "leaf",
    tone: "sand",
    place: "Estacionamento coberto",
    when: { weekly: 0, from: -45, until: null },
    time: ["09:00", "14:00"],
    interest: 38,
  },
  {
    title: "Yoga ao ar livre",
    category: "Bem-estar",
    description: "Aula aberta para todos os níveis. Traga seu tapete e uma garrafa de água.",
    icon: "sun",
    tone: "clay",
    place: "Gramado do Terraço",
    when: { weekly: 3, from: -30, until: 45 },
    time: ["07:30", "08:30"],
    interest: 21,
  },
  {
    title: "Roda de samba",
    category: "Música",
    description: "Samba de raiz com músicos da cidade. Chegue cedo para pegar mesa.",
    icon: "drama",
    tone: "deep",
    place: "Praça central",
    when: { single: 2 },
    time: ["19:00", "22:00"],
    interest: 57,
  },
  {
    title: "Cinema ao ar livre",
    category: "Cinema",
    description: "Sessão gratuita de um clássico nacional no telão. Leve sua canga.",
    icon: "film",
    tone: "ink",
    place: "Gramado do Terraço",
    when: { single: 3 },
    time: ["19:30", "21:30"],
    interest: 64,
  },
  {
    title: "Tour histórico guiado",
    category: "Cultura",
    description: "Um passeio pela história da fábrica e do bairro, com um guia da ARP.",
    icon: "landmark",
    tone: "sand",
    place: "Saída do Túnel do Tempo",
    when: { single: 1 },
    time: ["10:00", "11:30"],
    interest: 29,
  },
  {
    title: "Oficina de cerâmica",
    category: "Oficina",
    description: "Modelagem livre em argila para iniciantes. Vagas limitadas, material incluso.",
    icon: "hammer",
    tone: "clay",
    place: "Galpão cultural",
    when: { single: 5 },
    time: ["14:00", "17:00"],
    interest: 18,
  },
  {
    title: "Contação de histórias para crianças",
    category: "Cultura",
    description: "Histórias, música e brincadeiras para crianças de 3 a 8 anos.",
    icon: "book-open",
    tone: "green",
    place: "Espaço kids",
    when: { single: 6 },
    time: ["16:00", "17:00"],
    interest: 24,
  },
  {
    title: "Noite do vinho",
    category: "Gastronomia",
    description: "Degustação de rótulos nacionais com harmonização dos restaurantes parceiros.",
    icon: "wine",
    tone: "deep",
    place: "Terraço",
    when: { single: 9 },
    time: ["19:00", "23:00"],
    interest: 33,
  },
  {
    title: "Sarau de poesia",
    category: "Cultura",
    description: "Microfone aberto para poetas e leitores. Inscrições na hora.",
    icon: "mic-vocal",
    tone: "ink",
    place: "Galpão cultural",
    when: { single: 12 },
    time: ["19:00", "21:00"],
    interest: 15,
  },
  {
    title: "Feira de artesanato",
    category: "Cultura",
    description: "Artesãos da região com cerâmica, tecidos, madeira e bijuterias.",
    icon: "palette",
    tone: "sand",
    place: "Praça central",
    when: { range: [14, 16] },
    time: ["10:00", "19:00"],
    interest: 41,
  },
  {
    title: "Mostra de fotografia: Friburgo em foco",
    category: "Cultura",
    description: "Fotografias de moradores sobre a cidade e a serra. Visitação livre.",
    icon: "camera",
    tone: "green",
    place: "Corredor cultural",
    when: { range: [-10, 25] },
    time: null,
    longRunning: true,
    interest: 26,
  },
  {
    title: "Festival de Natal da ARP",
    category: "Música",
    description: "Coral, decoração iluminada e chegada do Papai Noel. Programação para a família.",
    icon: "star",
    tone: "clay",
    place: "Praça central",
    when: { range: [20, 30] },
    time: ["17:00", "22:00"],
    interest: 72,
  },
  {
    title: "Show de jazz no Terraço",
    category: "Música",
    description: "Quarteto de jazz instrumental ao pôr do sol.",
    icon: "guitar",
    tone: "ink",
    place: "Terraço",
    when: { single: -4 },
    time: ["18:00", "20:00"],
    interest: 30,
  },
  {
    title: "Encontro de food trucks",
    category: "Gastronomia",
    description: "Rascunho: datas e food trucks ainda a confirmar.",
    icon: "utensils",
    tone: "sand",
    place: "Estacionamento coberto",
    when: { single: 21 },
    time: ["12:00", "22:00"],
    status: "draft",
    interest: 0,
  },
];

/** Grava os eventos fictícios e o "Tenho interesse" dos visitantes fictícios. */
export async function insertDemoEvents(
  db: Database,
  rng: Random,
  clock: DemoClock,
  visitors: { id: string; created_at: Date; status: string }[],
): Promise<number> {
  const categories = await db.many<{ id: string; name: string }>(
    sql`select id, name from agenda.event_categories order by sort_order, name`,
  );
  const fallback = categories[0];
  if (!fallback) return 0;
  const byName = new Map(categories.map((c) => [c.name, c.id]));
  const today = toLocal(clock.now).date;
  const day = (offset: number) => addDaysToDate(today, offset);
  const created = new Date(clock.now.getTime() - 20 * DAY_MS);
  const active = visitors.filter((v) => v.status === "active");

  const interests: SqlFragment[] = [];
  for (const e of EVENTS) {
    let startsOn: string;
    let endsOn: string | null = null;
    let weekday: number | null = null;
    let recurrence: "single" | "range" | "weekly";
    if ("single" in e.when) {
      recurrence = "single";
      startsOn = day(e.when.single);
    } else if ("range" in e.when) {
      recurrence = "range";
      startsOn = day(e.when.range[0]);
      endsOn = day(e.when.range[1]);
    } else {
      recurrence = "weekly";
      weekday = e.when.weekly;
      startsOn = day(e.when.from);
      endsOn = e.when.until === null ? null : day(e.when.until);
    }
    const row = await db.one<{ id: string }>(sql`
      insert into agenda.events
        (title, category_id, description, tone, icon, place, recurrence, starts_on, ends_on,
         weekday, start_time, end_time, is_long_running, status, is_demo, created_at, updated_at)
      values
        (${e.title}, ${byName.get(e.category) ?? fallback.id}, ${e.description}, ${e.tone},
         ${e.icon}, ${e.place}, ${recurrence}, ${startsOn}::date, ${endsOn}::date, ${weekday},
         ${e.time?.[0] ?? null}::time, ${e.time?.[1] ?? null}::time, ${e.longRunning ?? false},
         ${e.status ?? "published"}, true, ${created}, ${created})
      returning id
    `);
    for (const v of rng.sample(active, e.interest)) {
      const from = Math.max(v.created_at.getTime(), clock.now.getTime() - 14 * DAY_MS);
      const at = new Date(from + rng.next() * Math.max(0, clock.now.getTime() - from - 60_000));
      interests.push(sql`(${v.id}, ${row.id}, ${at})`);
    }
  }
  if (interests.length > 0) {
    await db.query(sql`
      insert into agenda.event_interests (visitor_id, event_id, created_at)
      values ${sql.join(interests)}
    `);
  }
  return EVENTS.length;
}
