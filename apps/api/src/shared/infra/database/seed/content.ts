import type { ArtPointKind, ContentPageKey } from "@arp/contracts";
import { SITE_ART_POINTS, SITE_TEXTS } from "./site-data";

/*
 * Conteúdo da Fase 2, do site da ARP (espacoarp.com.br): história, regras,
 * Circuito Cultural e Sustentarp. A ARP edita tudo no painel depois.
 */

export const CONTENT_PAGES: readonly {
  key: ContentPageKey;
  title: string;
  body: string;
}[] = [
  { key: "history", title: "Nossa história", body: SITE_TEXTS.history },
  { key: "rules", title: "Regras da ARP", body: SITE_TEXTS.rules },
  {
    key: "club_rules",
    title: "Regulamento do Clube ARP",
    body: [
      "Cada selo vale pontos. Os pontos se somam e são trocados por prêmios na lojinha do Clube.",
      "Cada selo vence depois do prazo indicado nele (em geral, 6 meses). Quando vence, os pontos dele saem do total.",
      "O programa é anual: você tem até 1 ano para trocar os pontos. Avisamos antes de vencer.",
      "Os prêmios estão sujeitos a estoque. Sem estoque, o prêmio sai da lojinha.",
      "Selos não são trocados por cupons.",
      "A ARP pode mudar ou encerrar o programa, avisando os participantes.",
    ].join("\n\n"),
  },
  {
    key: "circuit",
    title: "Circuito Cultural",
    body: "Obras, memórias, esculturas e murais espalhados pela ARP. Visite os pontos e ganhe o selo Fio Cultural.",
  },
];

/** Pontos já marcados no mapa: [número, nome, artista, local, tipo, x%, y%]. */
const ART_PLACES: readonly [number, string, string, string, ArtPointKind, number, number][] = [
  [1, "Centro de Informações", "Raiz Turismo Receptivo", "Praça dos Contêineres", "work", 50, 46],
  [2, "Lunetas Catarinas", "", "Praça dos Contêineres", "work", 59, 50],
  [3, "Exposição Retrofit Arp", "", "Corredor do Bloco 4", "memory", 17, 13],
  [6, "Corredor Cultural", "", "Área de grande circulação", "work", 50, 36],
  [7, "Carimbos no asfalto", "Siron Franco e Rosélio", "Ruas internas", "work", 42, 54],
  [8, "Casarão Centenário Julius Arp", "", "Núcleo original da fábrica", "memory", 31, 22],
  [9, "Dançarinas do Vento", "Rogério Domingos", "Jardins da Arp", "sculpture", 36, 44],
  [
    10,
    "Mural “O Casarão”",
    "Cacau Rezende",
    "Ponto de ônibus do Boulevard Julius Arp",
    "mural",
    83,
    80,
  ],
  [17, "O Fio da Vida", "Eduardo Bueno", "Escultura em patchwork", "sculpture", 72, 17],
  [18, "Praça dos Bordados", "", "Praça dos Bordados", "work", 66, 43],
  [20, "Mega Grafite Quebra Lampiões", "Robson Sark", "Muro externo", "mural", 11, 61],
  [32, "Torre do Relógio", "", "Torre do Relógio", "memory", 86, 24],
  [34, "Beco das Artes", "", "Beco das Artes", "mural", 56, 61],
  [36, "Túnel do Tempo no Subsolo", "", "Subsolo da Arp", "memory", 75, 69],
  [40, "Chaminé da Fábrica", "", "Núcleo original da fábrica", "memory", 22, 35],
];

export const RECYCLING_ITEMS: readonly {
  name: string;
  icon: string;
  accepts: string;
  rejects: string;
  becomes: string;
  givesSeal?: boolean;
}[] = [
  {
    name: "Vidros",
    icon: "wine",
    accepts: "Cacos, potes de alimentos e conservas, vidros planos e garrafas.",
    rejects: "Azulejos, cerâmicas, espelhos, lâmpadas e vidro temperado.",
    becomes: "Vira vidro novo.",
  },
  {
    name: "Tampinhas plásticas",
    icon: "recycle",
    accepts: "Tampinhas de garrafa PET (PP, número 5).",
    rejects: "Tampas metálicas ou de borracha.",
    becomes: "Vira comedouro e bebedouro para animais.",
  },
  {
    name: "Botijas de gás butano",
    icon: "flame",
    accepts: "Botijas de fogareiro de acampamento ou maçarico de cozinha.",
    rejects: "Aerossol, inseticida, desodorante e tinta.",
    becomes: "Reciclagem de metais.",
  },
  {
    name: "Óleo vegetal",
    icon: "droplets",
    accepts: "Óleo de soja, canola, girassol e milho, em garrafa PET tampada.",
    rejects: "Óleo de motor ou sintético.",
    becomes: "Vira biodiesel e sabão.",
  },
  {
    name: "Eletroeletrônicos",
    icon: "zap",
    accepts: "Pilhas, baterias, eletrodomésticos e itens de informática.",
    rejects: "Lâmpadas, CDs e DVDs.",
    becomes: "É consertado e doado, ou reciclado.",
  },
  {
    name: "Cápsulas de café",
    icon: "coffee",
    accepts: "Qualquer marca ou modelo, de plástico ou metal.",
    rejects: "",
    becomes: "Vira alumínio, plástico e adubo.",
    givesSeal: true,
  },
  {
    name: "Saúde bucal",
    icon: "smile",
    accepts: "Escovas usadas, tubos de pasta vazios e embalagens de fio dental.",
    rejects: "",
    becomes: "Vira capas de caderno e porta-retratos.",
  },
];

/** Os 41 pontos do site, com local e posição dos que já estavam no mapa. */
export const ART_POINTS = SITE_ART_POINTS.map((p) => {
  const placed = ART_PLACES.find(([n]) => n === p.number);
  return {
    ...p,
    artist: p.artist || placed?.[2] || "",
    place: placed?.[3] ?? "",
    mapX: placed?.[5] ?? null,
    mapY: placed?.[6] ?? null,
  };
});
