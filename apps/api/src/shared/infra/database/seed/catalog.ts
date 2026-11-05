import { type AppSettings, PERMISSIONS, type Permission } from "@arp/contracts";
import { SITE_TEXTS } from "./site-data";

/*
 * Catálogo base: cargos, admin, selos, categorias da agenda e configurações.
 * Lojas, blocos, categorias e textos reais ficam em site-data.ts (do site da ARP).
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
      "coupons.approve",
      "challenges.view",
      "challenges.manage",
      "qr_codes.generate",
      "club.manage",
      "reports.view",
      "events.view",
      "events.manage",
      "highlights.view",
      "highlights.manage",
      "notifications.view",
      "notifications.manage",
      "content.view",
      "content.manage",
      "jobs.view",
      "jobs.manage",
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
      "jobs.view",
      "jobs.manage",
      "qr_codes.generate",
    ],
    isSystem: false,
  },
];

export const ADMIN_USER = { name: "Administrador ARP", email: "admin@arp.com.br" } as const;

/** Andares da ARP (nunca "Térreo"); a planta de cada um é desenhada no Mapa do painel. */
export const FLOORS = [
  { level: 0, label: "1º andar", shortLabel: "1º" },
  { level: 1, label: "2º andar", shortLabel: "2º" },
  { level: 2, label: "3º andar", shortLabel: "3º" },
] as const;

/* Selos ------------------------------------------------------------------ */

export const SEALS = [
  {
    slug: "explorador",
    name: "Origens",
    icon: "compass",
    from: "#7fd68d",
    to: "#2f7d3d",
    description: "Visitou o Túnel do Tempo.",
  },
  {
    slug: "mao-verde",
    name: "Transforma",
    icon: "recycle",
    from: "#9be0a5",
    to: "#3a9a4b",
    description: "Descartou no Sustentarp.",
  },
  {
    slug: "bom-garfo",
    name: "Sabores",
    icon: "utensils",
    from: "#f2b38a",
    to: "#c8692f",
    description: "Provou o prato do mês de um parceiro.",
  },
  {
    slug: "agito",
    name: "Energia",
    icon: "party-popper",
    from: "#c7a3ff",
    to: "#7d5a8c",
    description: "Participou de um evento (pode ganhar de novo).",
  },
  {
    slug: "cultural",
    name: "Fio Cultural",
    icon: "palette",
    from: "#ffd27a",
    to: "#c99220",
    description: "Fez o Circuito Cultural.",
  },
  {
    slug: "sem-fila",
    name: "Passe Livre",
    icon: "car",
    from: "#9cc5ff",
    to: "#2b4c6f",
    description: "Pagou o estacionamento pelo app.",
  },
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

/* Configurações do app --------------------------------------------------- */

export const SETTINGS: AppSettings = {
  couponDefaultWindowHours: 24,
  supportWhatsapp: SITE_TEXTS.phone,
  supportEmail: SITE_TEXTS.email,
  aboutText: SITE_TEXTS.about,
  termsUrl: null,
  privacyUrl: null,
  parkingInfo: SITE_TEXTS.parking,
  jobDays: 30,
  pointsValidityMonths: 12,
  pointsExpiryNoticeDays: 15,
  tourInfo: SITE_TEXTS.tour,
};
