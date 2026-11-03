import {
  type AppSettings,
  type CouponTone,
  type MapShape,
  type MapShapeKind,
  PERMISSIONS,
  type Permission,
  type StoreKind,
  type Tone,
} from "@arp/contracts";

/*
 * Catálogo de demonstração: o mesmo conteúdo do protótipo do app
 * (mobile-arp/src/data.js e screens.jsx), estruturado como o banco espera.
 * Nomes de lojas (exceto A Feitoria), eventos e números são fictícios.
 */

/* Cargos e usuários ------------------------------------------------------ */

export interface RoleSeed {
  name: string;
  description: string;
  permissions: readonly Permission[];
  isSystem: boolean;
}

export const ROLES: readonly RoleSeed[] = [
  {
    name: "Administrador",
    description: "Acesso total ao painel. Cargo do sistema.",
    permissions: PERMISSIONS,
    isSystem: true,
  },
  {
    name: "Marketing",
    description: "Cupons, desafios, agenda, destaques e notificações.",
    permissions: [
      "dashboard.view",
      "stores.view",
      "map.view",
      "coupons.view",
      "coupons.manage",
      "challenges.view",
      "challenges.manage",
      "events.view",
      "events.manage",
      "highlights.view",
      "highlights.manage",
      "notifications.view",
      "notifications.manage",
      "visitors.view",
    ],
    isSystem: false,
  },
  {
    name: "Atendimento",
    description: "Balcão de informações: valida cupons e atende visitantes.",
    permissions: [
      "stores.view",
      "map.view",
      "coupons.view",
      "coupons.redeem",
      "challenges.view",
      "events.view",
      "visitors.view",
      "visitors.manage",
    ],
    isSystem: false,
  },
  {
    name: "Lojista",
    description: "Dono ou gerente de loja: vê e valida só os cupons da própria loja.",
    permissions: [
      "dashboard.view",
      "stores.view",
      "coupons.view",
      "coupons.manage",
      "coupons.redeem",
    ],
    isSystem: false,
  },
];

export interface UserSeed {
  key: "admin" | "marketing" | "attendant" | "merchant";
  name: string;
  email: string;
  role: string;
  storeSlug: string | null;
  /** Último login há N horas (null = nunca entrou). */
  lastLoginHoursAgo: number | null;
}

export const USERS: readonly UserSeed[] = [
  {
    key: "admin",
    name: "Administrador ARP",
    email: "admin@arp.com.br",
    role: "Administrador",
    storeSlug: null,
    lastLoginHoursAgo: 2,
  },
  {
    key: "marketing",
    name: "Marina Lopes",
    email: "marketing@arp.com.br",
    role: "Marketing",
    storeSlug: null,
    lastLoginHoursAgo: 20,
  },
  {
    key: "attendant",
    name: "Juliana Reis",
    email: "atendimento@arp.com.br",
    role: "Atendimento",
    storeSlug: null,
    lastLoginHoursAgo: 5,
  },
  {
    key: "merchant",
    name: "Rafael Brandão",
    email: "casabrava@arp.com.br",
    role: "Lojista",
    storeSlug: "casa-brava",
    lastLoginHoursAgo: 26,
  },
];

/* Mapa ------------------------------------------------------------------- */

type ShapeTuple = [kind: MapShapeKind, label: string, x: number, y: number, w: number, h: number];
const shapes = (list: ShapeTuple[]): MapShape[] =>
  list.map(([kind, label, x, y, w, h]) => ({ kind, label, x, y, w, h }));

/** Desenho de cada andar = BLOCKS de screens.jsx (k: park → parking, sem k → block). */
export const FLOORS = [
  {
    level: 0,
    label: "1º andar",
    shortLabel: "1º",
    layout: shapes([
      ["block", "Bloco 80", 20, 40, 150, 160],
      ["block", "Bloco 81", 190, 40, 150, 120],
      ["parking", "Estacionamento", 190, 170, 150, 60],
      ["block", "Bloco 82", 20, 300, 320, 110],
      ["plaza", "Praça central", 100, 214, 160, 72],
    ]),
  },
  {
    level: 1,
    label: "2º andar",
    shortLabel: "2º",
    layout: shapes([
      ["block", "Bloco 80", 20, 40, 150, 170],
      ["block", "Bloco 81", 190, 40, 150, 170],
      ["bridge", "", 168, 108, 24, 34],
      ["void", "Vão da praça", 100, 222, 160, 60],
      ["block", "Bloco 82", 20, 300, 320, 110],
    ]),
  },
  {
    level: 2,
    label: "3º andar",
    shortLabel: "3º",
    layout: shapes([
      ["terrace", "Terraço", 20, 40, 150, 150],
      ["block", "Bloco 81", 190, 40, 150, 170],
      ["block", "Bloco 82", 20, 300, 320, 110],
    ]),
  },
] as const;

export const BLOCKS = [
  { name: "Bloco 80", sortOrder: 1 },
  { name: "Bloco 81", sortOrder: 2 },
  { name: "Bloco 82", sortOrder: 3 },
] as const;

export const MAP_POINTS = [
  { level: 0, x: 296, y: 356, icon: "recycle", label: "Ponto de reciclagem" },
  { level: 0, x: 180, y: 250, icon: "flag", label: "Início do tour" },
  { level: 0, x: 312, y: 200, icon: "car", label: "Estacionamento" },
  { level: 1, x: 180, y: 242, icon: "armchair", label: "Mirante da praça" },
  { level: 2, x: 96, y: 110, icon: "sun", label: "Terraço" },
] as const;

/* Lojas ------------------------------------------------------------------ */

/**
 * Subcategorias das 3 categorias do app (Fase 2): as mesmas do site da ARP
 * (espacoarp.com.br/lojas-e-servicos). "Academia" vem do menu do site.
 */
export const STORE_CATEGORIES: readonly {
  name: string;
  kind: StoreKind;
  icon: string;
  sortOrder: number;
}[] = [
  { name: "Acessórios", kind: "shop", icon: "gem", sortOrder: 1 },
  { name: "Moda", kind: "shop", icon: "shirt", sortOrder: 2 },
  { name: "Utilidades", kind: "shop", icon: "house", sortOrder: 3 },
  { name: "Varejo", kind: "shop", icon: "shopping-bag", sortOrder: 4 },
  { name: "Bar", kind: "food", icon: "beer", sortOrder: 1 },
  { name: "Confeitaria e Café", kind: "food", icon: "coffee", sortOrder: 2 },
  { name: "Padaria e Lanchonete", kind: "food", icon: "croissant", sortOrder: 3 },
  { name: "Pizzaria", kind: "food", icon: "pizza", sortOrder: 4 },
  { name: "Produtos Naturais", kind: "food", icon: "leaf", sortOrder: 5 },
  { name: "Restaurante", kind: "food", icon: "utensils", sortOrder: 6 },
  { name: "Sorveteria", kind: "food", icon: "ice-cream-cone", sortOrder: 7 },
  { name: "Academia", kind: "service", icon: "dumbbell", sortOrder: 1 },
  { name: "Advocacia", kind: "service", icon: "landmark", sortOrder: 2 },
  { name: "Agência e Eventos", kind: "service", icon: "party-popper", sortOrder: 3 },
  { name: "Arquitetura e Engenharia", kind: "service", icon: "building-2", sortOrder: 4 },
  { name: "Ateliê", kind: "service", icon: "scissors", sortOrder: 5 },
  { name: "Contabilidade e Finanças", kind: "service", icon: "banknote", sortOrder: 6 },
  { name: "Ensino", kind: "service", icon: "book-open", sortOrder: 7 },
  { name: "Estética e Beleza", kind: "service", icon: "sparkles", sortOrder: 8 },
  { name: "Fotografia", kind: "service", icon: "camera", sortOrder: 9 },
  { name: "Imobiliária e Corretora", kind: "service", icon: "key-round", sortOrder: 10 },
  { name: "Indústria", kind: "service", icon: "hammer", sortOrder: 11 },
  { name: "Lazer", kind: "service", icon: "gamepad-2", sortOrder: 12 },
  { name: "Saúde", kind: "service", icon: "stethoscope", sortOrder: 13 },
  { name: "Tecnologia", kind: "service", icon: "laptop", sortOrder: 14 },
  { name: "Veterinária", kind: "service", icon: "paw-print", sortOrder: 15 },
];

/** [dias da semana (0 = dom), abre, fecha]. Fecha <= abre = passa da meia-noite. */
type HoursRule = [weekdays: number[], opensAt: string, closesAt: string];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const TUE_TO_SUN = [0, 2, 3, 4, 5, 6];
const MON_TO_SAT = [1, 2, 3, 4, 5, 6];
const MON_TO_FRI = [1, 2, 3, 4, 5];

export interface StoreSeed {
  slug: string;
  name: string;
  kind: StoreKind;
  category: string;
  /** Subcategorias extras [tipo, nome]: a loja aparece nelas também. */
  extraCategories?: readonly [StoreKind, string][];
  block: string;
  level: number;
  icon: string;
  brandColor: string;
  mapX: number;
  mapY: number;
  description: string;
  /** Arquivo em seed-assets/ usado como capa. */
  image: string;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  hours: HoursRule[];
}

export const STORES: readonly StoreSeed[] = [
  {
    slug: "a-feitoria",
    name: "A Feitoria",
    kind: "food",
    category: "Restaurante",
    block: "Bloco 80",
    level: 0,
    icon: "utensils",
    brandColor: "#2f7d3d",
    mapX: 72,
    mapY: 96,
    description:
      "Cozinha brasileira de fazenda, com almoço executivo e o prato do mês, que vale selo.",
    image: "feitoria.jpg",
    phone: null,
    whatsapp: null,
    instagram: null,
    hours: [[EVERY_DAY, "11:00", "23:00"]],
  },
  {
    slug: "casa-brava",
    name: "Casa Brava",
    kind: "food",
    category: "Bar",
    block: "Bloco 82",
    level: 0,
    icon: "beer",
    brandColor: "#c8692f",
    mapX: 96,
    mapY: 352,
    description: "Cervejaria artesanal com chopes da serra, petiscos e música ao vivo às sextas.",
    image: "casabrava.jpg",
    phone: "(24) 2231-4080",
    whatsapp: "(24) 99231-4080",
    instagram: "@casabrava.arp",
    hours: [
      [[0, 1, 2, 3, 4], "16:00", "00:00"],
      [[5, 6], "16:00", "01:00"],
    ],
  },
  {
    slug: "cafe-da-serra",
    name: "Café da Serra",
    kind: "food",
    category: "Confeitaria e Café",
    block: "Bloco 80",
    level: 1,
    icon: "coffee",
    brandColor: "#7a5233",
    mapX: 70,
    mapY: 92,
    description:
      "Cafés especiais de produtores da região, pães de fermentação natural e doces da casa.",
    image: "cafeserra.jpg",
    phone: "(24) 2231-1180",
    whatsapp: null,
    instagram: "@cafedaserra",
    hours: [
      [MON_TO_SAT, "08:00", "20:00"],
      [[0], "08:00", "18:00"],
    ],
  },
  {
    slug: "doce-tilia",
    name: "Doce Tília",
    kind: "food",
    category: "Confeitaria e Café",
    extraCategories: [["food", "Sorveteria"]],
    block: "Bloco 81",
    level: 0,
    icon: "ice-cream-cone",
    brandColor: "#d0607a",
    mapX: 248,
    mapY: 96,
    description: "Brigaderia e sorveteria artesanal. Os sabores mudam toda semana.",
    image: "docetilia.jpg",
    phone: null,
    whatsapp: "(24) 99812-3344",
    instagram: "@docetilia",
    hours: [[EVERY_DAY, "10:00", "22:00"]],
  },
  {
    slug: "massa-fina",
    name: "Massa Fina",
    kind: "food",
    category: "Restaurante",
    extraCategories: [["food", "Pizzaria"]],
    block: "Bloco 82",
    level: 1,
    icon: "pizza",
    brandColor: "#b8452e",
    mapX: 110,
    mapY: 350,
    description: "Pizza de longa fermentação em forno a lenha.",
    image: "massafina.jpg",
    phone: "(24) 2231-8282",
    whatsapp: "(24) 99231-8282",
    instagram: "@massafina.pizza",
    hours: [[TUE_TO_SUN, "18:00", "23:30"]],
  },
  {
    slug: "kiro-sushi",
    name: "Kiro Sushi",
    kind: "food",
    category: "Restaurante",
    block: "Bloco 81",
    level: 2,
    icon: "fish",
    brandColor: "#2b4c6f",
    mapX: 236,
    mapY: 92,
    description: "Cozinha japonesa contemporânea com balcão de omakase.",
    image: "kiro.jpg",
    phone: "(24) 2231-5050",
    whatsapp: null,
    instagram: "@kirosushi",
    hours: [[TUE_TO_SUN, "12:00", "23:00"]],
  },
  {
    slug: "atelie-linho",
    name: "Ateliê Linho",
    kind: "shop",
    category: "Moda",
    extraCategories: [["service", "Ateliê"]],
    block: "Bloco 80",
    level: 1,
    icon: "shirt",
    brandColor: "#8a7a5c",
    mapX: 126,
    mapY: 168,
    description: "Moda autoral em fibras naturais, feita em pequenas tiragens.",
    image: "linho.jpg",
    phone: null,
    whatsapp: "(24) 99877-1020",
    instagram: "@atelielinho",
    hours: [
      [MON_TO_SAT, "10:00", "22:00"],
      [[0], "12:00", "20:00"],
    ],
  },
  {
    slug: "entrelinhas",
    name: "Entrelinhas",
    kind: "shop",
    category: "Varejo",
    extraCategories: [["food", "Confeitaria e Café"]],
    block: "Bloco 81",
    level: 1,
    icon: "book-open",
    brandColor: "#4a5d8a",
    mapX: 252,
    mapY: 100,
    description: "Livraria e café com curadoria independente e clube de leitura mensal.",
    image: "entrelinhas.jpg",
    phone: "(24) 2231-7712",
    whatsapp: null,
    instagram: "@entrelinhas.livros",
    hours: [[EVERY_DAY, "10:00", "22:00"]],
  },
  {
    slug: "otica-vista",
    name: "Ótica Vista",
    kind: "shop",
    category: "Acessórios",
    extraCategories: [["service", "Saúde"]],
    block: "Bloco 80",
    level: 0,
    icon: "glasses",
    brandColor: "#3c6e71",
    mapX: 130,
    mapY: 158,
    description: "Óculos de grau e de sol, com exame de vista agendado.",
    image: "vista.jpg",
    phone: "(24) 2231-3030",
    whatsapp: "(24) 99231-3030",
    instagram: null,
    hours: [[MON_TO_SAT, "10:00", "20:00"]],
  },
  {
    slug: "casa-mata",
    name: "Casa Mata",
    kind: "shop",
    category: "Utilidades",
    block: "Bloco 81",
    level: 2,
    icon: "sofa",
    brandColor: "#6b7f4e",
    mapX: 292,
    mapY: 168,
    description: "Decoração, plantas e objetos de artesãos da serra.",
    image: "casamata.jpg",
    phone: null,
    whatsapp: "(24) 99654-7788",
    instagram: "@casamata.arp",
    hours: [[EVERY_DAY, "10:00", "20:00"]],
  },
  {
    slug: "pet-point",
    name: "Pet Point",
    kind: "service",
    category: "Veterinária",
    extraCategories: [["shop", "Varejo"]],
    block: "Bloco 82",
    level: 2,
    icon: "paw-print",
    brandColor: "#a0743a",
    mapX: 92,
    mapY: 350,
    description: "Pet shop com banho e tosa. Pets são bem-vindos na ARP.",
    image: "petpoint.jpg",
    phone: "(24) 2231-6060",
    whatsapp: "(24) 99231-6060",
    instagram: "@petpoint",
    hours: [[MON_TO_SAT, "09:00", "19:00"]],
  },
  {
    slug: "alto-pilates",
    name: "Alto Pilates",
    kind: "service",
    category: "Academia",
    extraCategories: [["service", "Saúde"]],
    block: "Bloco 82",
    level: 2,
    icon: "flower-2",
    brandColor: "#7d5a8c",
    mapX: 262,
    mapY: 352,
    description: "Studio de pilates e yoga com aula experimental gratuita.",
    image: "pilates.jpg",
    phone: null,
    whatsapp: "(24) 99140-2121",
    instagram: "@altopilates",
    hours: [
      [MON_TO_FRI, "06:00", "21:00"],
      [[6], "08:00", "13:00"],
    ],
  },
  {
    slug: "barbearia-82",
    name: "Barbearia 82",
    kind: "service",
    category: "Estética e Beleza",
    block: "Bloco 82",
    level: 1,
    icon: "scissors",
    brandColor: "#3a3a3a",
    mapX: 268,
    mapY: 360,
    description: "Corte, barba e chope gelado enquanto espera.",
    image: "barbearia.jpg",
    phone: null,
    whatsapp: "(24) 99382-8282",
    instagram: "@barbearia82",
    hours: [[[2, 3, 4, 5, 6], "09:00", "20:00"]],
  },
];

/* Cupons ----------------------------------------------------------------- */

/** Instante relativo a hoje: [dias a partir de hoje, "HH:mm"] ou âncoras especiais. */
export type When =
  | { day: number; time?: string }
  | { monthEnd: true }
  | { nextSunday: string }
  | { hoursAgo: number };

export interface CouponSeed {
  /** Id do protótipo (c1…) ou extra (x1…): só para ligar destaques/notificações. */
  ref: string;
  storeSlug: string;
  title: string;
  headline: string;
  headlineSub: string | null;
  description: string | null;
  scheduleNote: string;
  startsAt: When;
  endsAt: When | null;
  totalQuantity: number;
  redeemWindowHours: number;
  tone: CouponTone;
  icon: string;
  image: string | null;
  savingsCents: number;
  status: "draft" | "active" | "paused" | "ended";
  /**
   * Pegos que contam no estoque agora (ativos no prazo + usados), como o
   * "taken" do protótipo. null = o que a simulação der.
   */
  takenNow: number | null;
  /** Procura simulada (tentativas de pegar ao longo do período). */
  demand: number;
}

export const COUPONS: readonly CouponSeed[] = [
  {
    ref: "c1",
    storeSlug: "casa-brava",
    title: "Chopp de R$ 10 por R$ 5",
    headline: "R$ 5",
    headlineSub: "o chopp",
    description: "Chopp pilsen da casa (300 ml) pela metade do preço. Um por pessoa.",
    scheduleNote: "Só hoje, até 23h",
    startsAt: { day: 0, time: "00:00" },
    endsAt: { day: 0, time: "23:00" },
    totalQuantity: 15,
    redeemWindowHours: 24,
    tone: "green",
    icon: "beer",
    image: "cp-chopp.jpg",
    savingsCents: 500,
    status: "active",
    takenNow: 12,
    demand: 12,
  },
  {
    ref: "c2",
    storeSlug: "a-feitoria",
    title: "Sobremesa grátis no almoço executivo",
    headline: "Grátis",
    headlineSub: "a sobremesa",
    description: "Na compra do almoço executivo, a sobremesa do dia é por conta da casa.",
    scheduleNote: "Seg a sex, 11h às 15h",
    startsAt: { day: -40, time: "00:00" },
    endsAt: null,
    totalQuantity: 30,
    redeemWindowHours: 12,
    tone: "sand",
    icon: "cake-slice",
    image: "cp-sobremesa.jpg",
    savingsCents: 2200,
    status: "active",
    takenNow: 21,
    demand: 30,
  },
  {
    ref: "c4",
    storeSlug: "atelie-linho",
    title: "15% OFF em toda a loja",
    headline: "15%",
    headlineSub: "OFF",
    description: "Desconto em todas as peças, inclusive a coleção nova. Não cumulativo.",
    scheduleNote: "Até domingo",
    startsAt: { day: -6, time: "10:00" },
    endsAt: { nextSunday: "22:00" },
    totalQuantity: 20,
    redeemWindowHours: 48,
    tone: "green",
    icon: "shirt",
    image: "cp-roupa.jpg",
    savingsCents: 4500,
    status: "active",
    takenNow: 18,
    demand: 26,
  },
  {
    ref: "c3",
    storeSlug: "cafe-da-serra",
    title: "Segundo café pela metade do preço",
    headline: "50%",
    headlineSub: "no 2º café",
    description: "Pediu um café especial? O segundo sai pela metade do preço.",
    scheduleNote: "Todos os dias",
    startsAt: { day: -60, time: "08:00" },
    endsAt: null,
    totalQuantity: 40,
    redeemWindowHours: 24,
    tone: "sand",
    icon: "coffee",
    image: "cp-cafe.jpg",
    savingsCents: 600,
    status: "active",
    takenNow: 18,
    demand: 20,
  },
  {
    ref: "c5",
    storeSlug: "entrelinhas",
    title: "R$ 20 OFF em compras acima de R$ 100",
    headline: "R$ 20",
    headlineSub: "OFF",
    description: "Vale para livros e papelaria. Não vale para encomendas.",
    scheduleNote: "Até o fim do mês",
    startsAt: { day: -20, time: "10:00" },
    endsAt: { monthEnd: true },
    totalQuantity: 25,
    redeemWindowHours: 24,
    tone: "green",
    icon: "book-open",
    image: "cp-livros.jpg",
    savingsCents: 2000,
    status: "active",
    takenNow: 25,
    demand: 60,
  },
  {
    ref: "c6",
    storeSlug: "doce-tilia",
    title: "Leve 2 brigadeiros, pague 1",
    headline: "1 + 1",
    headlineSub: "brigadeiro",
    description: "Escolha dois brigadeiros gourmet e pague só um.",
    scheduleNote: "Fins de semana",
    startsAt: { day: -45, time: "10:00" },
    endsAt: null,
    totalQuantity: 50,
    redeemWindowHours: 24,
    tone: "sand",
    icon: "ice-cream-cone",
    image: "cp-brigadeiro.jpg",
    savingsCents: 900,
    status: "active",
    takenNow: 19,
    demand: 24,
  },
  {
    ref: "x1",
    storeSlug: "massa-fina",
    title: "R$ 25 OFF na pizza grande",
    headline: "R$ 25",
    headlineSub: "OFF",
    description: "Na pizza grande de qualquer sabor, de terça a quinta.",
    scheduleNote: "Ter a qui, a partir das 18h",
    startsAt: { day: -85, time: "18:00" },
    endsAt: { day: -55, time: "23:30" },
    totalQuantity: 40,
    redeemWindowHours: 24,
    tone: "green",
    icon: "pizza",
    image: "massafina.jpg",
    savingsCents: 2500,
    status: "ended",
    takenNow: null,
    demand: 48,
  },
  {
    ref: "x2",
    storeSlug: "kiro-sushi",
    title: "Temaki em dobro às quartas",
    headline: "2x",
    headlineSub: "temaki",
    description: "Peça um temaki e ganhe outro do mesmo sabor.",
    scheduleNote: "Quartas, 12h às 15h",
    startsAt: { day: -70, time: "12:00" },
    endsAt: { day: -35, time: "15:00" },
    totalQuantity: 30,
    redeemWindowHours: 12,
    tone: "sand",
    icon: "fish",
    image: "kiro.jpg",
    savingsCents: 3200,
    status: "ended",
    takenNow: null,
    demand: 36,
  },
  {
    ref: "x3",
    storeSlug: "pet-point",
    title: "20% OFF no banho e tosa",
    headline: "20%",
    headlineSub: "OFF",
    description: "Para cães e gatos de todos os portes. Agende pelo WhatsApp.",
    scheduleNote: "Seg a sex",
    startsAt: { day: -50, time: "09:00" },
    endsAt: { day: -12, time: "19:00" },
    totalQuantity: 35,
    redeemWindowHours: 48,
    tone: "green",
    icon: "paw-print",
    image: "petpoint.jpg",
    savingsCents: 1600,
    status: "ended",
    takenNow: null,
    demand: 30,
  },
  {
    ref: "x4",
    storeSlug: "alto-pilates",
    title: "Aula experimental + 10% no plano",
    headline: "10%",
    headlineSub: "no plano",
    description: "Aula experimental gratuita e 10% de desconto no primeiro plano.",
    scheduleNote: "Novos alunos",
    startsAt: { day: -30, time: "06:00" },
    endsAt: null,
    totalQuantity: 25,
    redeemWindowHours: 72,
    tone: "sand",
    icon: "flower-2",
    image: "pilates.jpg",
    savingsCents: 2800,
    status: "paused",
    takenNow: null,
    demand: 10,
  },
  {
    ref: "x5",
    storeSlug: "barbearia-82",
    title: "Barba grátis no corte de sexta",
    headline: "Grátis",
    headlineSub: "a barba",
    description: "Cortou o cabelo na sexta? A barba é por nossa conta.",
    scheduleNote: "Sextas",
    startsAt: { day: 3, time: "09:00" },
    endsAt: { day: 40, time: "20:00" },
    totalQuantity: 20,
    redeemWindowHours: 24,
    tone: "green",
    icon: "scissors",
    image: "barbearia.jpg",
    savingsCents: 3500,
    status: "draft",
    takenNow: null,
    demand: 0,
  },
];

/* Selos, desafios e faixas ----------------------------------------------- */

export const SEALS = [
  {
    slug: "explorador",
    name: "Explorador",
    icon: "compass",
    from: "#7fd68d",
    to: "#2f7d3d",
    description: "Fez o tour da ARP.",
  },
  {
    slug: "mao-verde",
    name: "Mão Verde",
    icon: "recycle",
    from: "#9be0a5",
    to: "#3a9a4b",
    description: "Descartou vidro no ponto de reciclagem.",
  },
  {
    slug: "bom-garfo",
    name: "Bom Garfo",
    icon: "utensils",
    from: "#f2b38a",
    to: "#c8692f",
    description: "Provou o prato do mês.",
  },
  {
    slug: "agito",
    name: "Agito",
    icon: "party-popper",
    from: "#c7a3ff",
    to: "#7d5a8c",
    description: "Participou de um evento.",
  },
  {
    slug: "cultural",
    name: "Cultural",
    icon: "palette",
    from: "#ffd27a",
    to: "#c99220",
    description: "Visitou o Corredor Cultural.",
  },
  {
    slug: "sem-fila",
    name: "Sem Fila",
    icon: "car",
    from: "#9cc5ff",
    to: "#2b4c6f",
    description: "Pagou o estacionamento pelo app.",
  },
] as const;

export interface ChallengeSeed {
  ref: "tour" | "descarte" | "prato" | "evento" | "cultural" | "estac";
  seal: (typeof SEALS)[number]["slug"];
  title: string;
  howTo: string;
  icon: string;
  validation: "qr" | "auto";
  storeSlug: string | null;
  /** Título do evento ligado ao desafio (só na campanha corrente). */
  eventTitle: string | null;
  /** Rótulos dos QR Codes (vazio na validação automática). */
  qrLabels: string[];
  /** Chance de um participante do mês cumprir (deixa o dashboard com cara real). */
  popularity: number;
}

export const CHALLENGES: readonly ChallengeSeed[] = [
  {
    ref: "tour",
    seal: "explorador",
    title: "Faça o tour da ARP",
    howTo: "QR Code no fim do tour, na praça central",
    icon: "compass",
    validation: "qr",
    storeSlug: null,
    eventTitle: null,
    qrLabels: ["Totem da praça central"],
    popularity: 0.55,
  },
  {
    ref: "descarte",
    seal: "mao-verde",
    title: "Descarte vidro no ponto de reciclagem",
    howTo: "QR Code no ponto de descarte · Bloco 82",
    icon: "recycle",
    validation: "qr",
    storeSlug: null,
    eventTitle: null,
    qrLabels: ["Ponto de reciclagem · Bloco 82"],
    popularity: 0.35,
  },
  {
    ref: "prato",
    seal: "bom-garfo",
    title: "Prove o prato do mês na A Feitoria",
    howTo: "O QR Code vem junto com a conta",
    icon: "utensils",
    validation: "qr",
    storeSlug: "a-feitoria",
    eventTitle: null,
    qrLabels: ["Conta da A Feitoria"],
    popularity: 0.3,
  },
  {
    ref: "evento",
    seal: "agito",
    title: "Participe de um evento",
    howTo: "QR Code na entrada do evento",
    icon: "party-popper",
    validation: "qr",
    storeSlug: null,
    eventTitle: null,
    qrLabels: ["Entrada · Praça central", "Entrada · Terraço"],
    popularity: 0.4,
  },
  {
    ref: "cultural",
    seal: "cultural",
    title: "Visite o Corredor Cultural",
    howTo: "QR Code no totem do corredor",
    icon: "palette",
    validation: "qr",
    storeSlug: null,
    eventTitle: "Corredor Cultural",
    qrLabels: ["Totem do Corredor Cultural"],
    popularity: 0.45,
  },
  {
    ref: "estac",
    seal: "sem-fila",
    title: "Pague o estacionamento pelo app",
    howTo: "Validação automática ao pagar",
    icon: "car",
    validation: "auto",
    storeSlug: null,
    eventTitle: null,
    qrLabels: [],
    popularity: 0.25,
  },
];

export const TIERS = [
  { threshold: 3, label: "10% OFF no estacionamento", icon: "car" },
  { threshold: 6, label: "Selo Ouro: brinde + sorteio do mês", icon: "gift" },
] as const;

/* Agenda ----------------------------------------------------------------- */

export const EVENT_CATEGORIES = [
  { name: "Cultura", icon: "palette", sortOrder: 1 },
  { name: "Música", icon: "music", sortOrder: 2 },
  { name: "Gastronomia", icon: "apple", sortOrder: 3 },
  { name: "Oficina", icon: "hammer", sortOrder: 4 },
  { name: "Cinema", icon: "clapperboard", sortOrder: 5 },
  { name: "Bem-estar", icon: "heart-pulse", sortOrder: 6 },
] as const;

export interface EventSeed {
  title: string;
  category: string;
  description: string;
  image: string | null;
  tone: Tone | null;
  icon: string | null;
  place: string;
  level: number | null;
  storeSlug: string | null;
  recurrence: "single" | "range" | "weekly";
  /** Dias a partir de hoje, ou "monthStart"/"monthEnd". */
  startsOn: number | "monthStart";
  endsOn: number | "monthEnd" | null;
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
  isLongRunning: boolean;
  awardsSeal: boolean;
  status: "draft" | "published" | "cancelled";
}

export const EVENTS: readonly EventSeed[] = [
  {
    title: "Corredor Cultural",
    category: "Cultura",
    description:
      "Durante todo o mês, as ruas da ARP recebem música, dança, artesanato e intervenções de artistas da região. Programação diferente a cada dia.",
    image: "festa.webp",
    tone: null,
    icon: null,
    place: "Ruas internas · 1º andar",
    level: 0,
    storeSlug: null,
    recurrence: "range",
    startsOn: "monthStart",
    endsOn: "monthEnd",
    weekday: null,
    startTime: "10:00",
    endTime: "22:00",
    isLongRunning: true,
    awardsSeal: true,
    status: "published",
  },
  {
    title: "Roda de Samba",
    category: "Música",
    description:
      "Roda aberta com o grupo da casa e convidados. Chegue cedo para pegar lugar perto da roda.",
    image: "ev-samba.jpg",
    tone: "green",
    icon: "music",
    place: "Praça central",
    level: 0,
    storeSlug: null,
    recurrence: "single",
    startsOn: 0,
    endsOn: null,
    weekday: null,
    startTime: "18:00",
    endTime: null,
    isLongRunning: false,
    awardsSeal: true,
    status: "published",
  },
  {
    title: "Jazz no Pátio",
    category: "Música",
    description: "Quarteto de jazz ao ar livre, com cadeiras na praça e chope da Casa Brava.",
    image: "ev-jazz.jpg",
    tone: null,
    icon: null,
    place: "Praça central",
    level: 0,
    storeSlug: "casa-brava",
    recurrence: "single",
    startsOn: 2,
    endsOn: null,
    weekday: null,
    startTime: "19:00",
    endTime: null,
    isLongRunning: false,
    awardsSeal: true,
    status: "published",
  },
  {
    title: "Feira de Produtores",
    category: "Gastronomia",
    description: "Queijos, cafés, hortaliças orgânicas e pães de produtores da serra. Todo sábado.",
    image: "ev-feira.jpg",
    tone: "green",
    icon: "apple",
    place: "Praça central",
    level: 0,
    storeSlug: null,
    recurrence: "weekly",
    startsOn: -120,
    endsOn: null,
    weekday: 6,
    startTime: "09:00",
    endTime: "14:00",
    isLongRunning: false,
    awardsSeal: false,
    status: "published",
  },
  {
    title: "Oficina de Cerâmica",
    category: "Oficina",
    description: "Três tardes para criar sua própria peça, do torno à queima. Vagas limitadas.",
    image: "ev-ceramica.jpg",
    tone: "clay",
    icon: "palette",
    place: "Casa Mata · Bloco 81 · 3º andar",
    level: 2,
    storeSlug: "casa-mata",
    recurrence: "range",
    startsOn: 1,
    endsOn: 3,
    weekday: null,
    startTime: "14:00",
    endTime: "17:00",
    isLongRunning: false,
    awardsSeal: true,
    status: "published",
  },
  {
    title: "Cinema ao ar livre",
    category: "Cinema",
    description: "Sessão de clássicos nacionais com pipoca e mantas. Traga sua cadeira.",
    image: "ev-cinema.jpg",
    tone: null,
    icon: null,
    place: "Terraço · 3º andar",
    level: 2,
    storeSlug: null,
    recurrence: "single",
    startsOn: 5,
    endsOn: null,
    weekday: null,
    startTime: "18:30",
    endTime: null,
    isLongRunning: false,
    awardsSeal: true,
    status: "published",
  },
  {
    title: "Yoga ao amanhecer",
    category: "Bem-estar",
    description: "Aula aberta com o Alto Pilates. Leve seu tapete.",
    image: "ev-yoga.jpg",
    tone: "ink",
    icon: "sun",
    place: "Terraço · 3º andar",
    level: 2,
    storeSlug: "alto-pilates",
    recurrence: "weekly",
    startsOn: -90,
    endsOn: null,
    weekday: 0,
    startTime: "08:00",
    endTime: null,
    isLongRunning: false,
    awardsSeal: false,
    status: "published",
  },
  {
    title: "Festival de Inverno",
    category: "Música",
    description: "Quatro dias de shows acústicos e gastronomia de inverno na praça central.",
    image: "espaco.webp",
    tone: null,
    icon: null,
    place: "Praça central",
    level: 0,
    storeSlug: null,
    recurrence: "range",
    startsOn: -52,
    endsOn: -49,
    weekday: null,
    startTime: "17:00",
    endTime: "23:00",
    isLongRunning: false,
    awardsSeal: true,
    status: "published",
  },
  {
    title: "Sarau de poesia",
    category: "Cultura",
    description: "Microfone aberto para poetas da região, com curadoria da Entrelinhas.",
    image: null,
    tone: "deep",
    icon: "book-open",
    place: "Entrelinhas · Bloco 81 · 1º",
    level: 1,
    storeSlug: "entrelinhas",
    recurrence: "single",
    startsOn: 12,
    endsOn: null,
    weekday: null,
    startTime: "19:30",
    endTime: "21:30",
    isLongRunning: false,
    awardsSeal: false,
    status: "draft",
  },
  {
    title: "Show de rock na praça",
    category: "Música",
    description: "Cancelado por previsão de chuva forte. Nova data em breve.",
    image: null,
    tone: "ink",
    icon: "guitar",
    place: "Praça central",
    level: 0,
    storeSlug: null,
    recurrence: "single",
    startsOn: 8,
    endsOn: null,
    weekday: null,
    startTime: "20:00",
    endTime: null,
    isLongRunning: false,
    awardsSeal: false,
    status: "cancelled",
  },
];

/* Configurações do app --------------------------------------------------- */

export const SETTINGS: AppSettings = {
  couponDefaultWindowHours: 24,
  supportWhatsapp: "(24) 99999-0080",
  supportEmail: "atendimento@arp.com.br",
  aboutText:
    "A ARP é um complexo de lojas, restaurantes e cultura numa antiga fábrica da serra. Pelo app você encontra lojas, pega cupons, acompanha a agenda e ganha selos nos desafios do mês.",
  termsUrl: null,
  privacyUrl: null,
  parkingInfo:
    "Pague o estacionamento pelo app e ganhe o selo Sem Fila no mesmo instante. A integração com o sistema do estacionamento ainda será definida.",
  tourInfo:
    "Um passeio de 40 minutos pela história da fábrica, os blocos e a praça. No fim, leia o QR Code e ganhe o selo Explorador.",
};

/* Visitantes ------------------------------------------------------------- */

export const DEMO_VISITOR = {
  name: "Ana Clara Souza",
  email: "ana.clara@example.com",
  phone: "(24) 98888-1234",
  avatar: "avatar.jpg",
} as const;

export const FIRST_NAMES = [
  "Ana",
  "Beatriz",
  "Bruna",
  "Camila",
  "Carolina",
  "Clara",
  "Daniela",
  "Eduarda",
  "Fernanda",
  "Gabriela",
  "Helena",
  "Isabela",
  "Júlia",
  "Larissa",
  "Letícia",
  "Luana",
  "Manuela",
  "Mariana",
  "Natália",
  "Patrícia",
  "Renata",
  "Sofia",
  "Tainá",
  "Valentina",
  "Yasmin",
  "André",
  "Arthur",
  "Bernardo",
  "Bruno",
  "Caio",
  "Carlos",
  "Daniel",
  "Davi",
  "Diego",
  "Eduardo",
  "Felipe",
  "Gabriel",
  "Gustavo",
  "Heitor",
  "Igor",
  "João",
  "José",
  "Leonardo",
  "Lucas",
  "Marcelo",
  "Mateus",
  "Miguel",
  "Otávio",
  "Paulo",
  "Pedro",
  "Rafael",
  "Ricardo",
  "Rodrigo",
  "Thiago",
  "Vinícius",
  "Wesley",
] as const;

export const LAST_NAMES = [
  "Almeida",
  "Alves",
  "Andrade",
  "Araújo",
  "Barbosa",
  "Barros",
  "Cardoso",
  "Carvalho",
  "Castro",
  "Costa",
  "Cunha",
  "Dias",
  "Duarte",
  "Fernandes",
  "Ferreira",
  "Freitas",
  "Gomes",
  "Lima",
  "Lopes",
  "Macedo",
  "Machado",
  "Martins",
  "Medeiros",
  "Melo",
  "Mendes",
  "Monteiro",
  "Moreira",
  "Nascimento",
  "Nogueira",
  "Oliveira",
  "Pereira",
  "Pinto",
  "Ramos",
  "Ribeiro",
  "Rocha",
  "Rodrigues",
  "Santos",
  "Siqueira",
  "Silva",
  "Soares",
  "Teixeira",
  "Vieira",
] as const;
