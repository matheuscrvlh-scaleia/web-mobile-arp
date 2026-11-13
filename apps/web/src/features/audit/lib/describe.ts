import type { AuditLog } from "@arp/contracts";
import { PATHS } from "@/shared/config/paths";
import { formatDateTime } from "@/shared/lib/format";

// Tradução do registro técnico (store.update, { brandColor: {from, to} })
// para algo que a equipe lê: "Maria editou a loja Casa Brava", "Cor da marca: #fff → #000".

type Noun = { label: string; article: "o" | "a" };
const n = (label: string, article: "o" | "a"): Noun => ({ label, article });

const NOUNS: Record<string, Noun> = {
  store: n("Loja", "a"),
  store_category: n("Categoria de loja", "a"),
  storeCategory: n("Categoria de loja", "a"),
  block: n("Bloco", "o"),
  floor: n("Andar", "o"),
  map_point: n("Ponto do mapa", "o"),
  mapPoint: n("Ponto do mapa", "o"),
  art_point: n("Ponto do Circuito Cultural", "o"),
  recycling_item: n("Item do Sustentarp", "o"),
  content_page: n("Texto do app", "o"),
  job: n("Vaga", "a"),
  coupon: n("Promoção", "a"),
  claim: n("Cupom pego", "o"),
  coupon_claim: n("Cupom pego", "o"),
  seal: n("Selo", "o"),
  earned_seal: n("Selo", "o"),
  campaign: n("Campanha", "a"),
  challenge: n("Desafio", "o"),
  qr_code: n("QR Code", "o"),
  qrCode: n("QR Code", "o"),
  prize: n("Prêmio", "o"),
  prize_redemption: n("Troca do Clube", "a"),
  event: n("Evento", "o"),
  event_category: n("Categoria de evento", "a"),
  eventCategory: n("Categoria de evento", "a"),
  highlight: n("Destaque", "o"),
  notification: n("Notificação", "a"),
  visitor: n("Visitante", "o"),
  user: n("Usuário", "o"),
  role: n("Cargo", "o"),
  merchant_invite: n("Link de cadastro de lojista", "o"),
  merchant_signup: n("Cadastro de lojista", "o"),
  settings: n("Configurações", "a"),
  setting: n("Configurações", "a"),
  upload: n("Imagem", "a"),
  session: n("Acesso", "o"),
  auth: n("Acesso", "o"),
};

/** Rótulo do tipo de item (filtro "Tipo de item"). */
export const ENTITY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(NOUNS).map(([k, v]) => [k, v.label]),
);

const VERBS: Record<string, string> = {
  create: "criou",
  update: "editou",
  delete: "excluiu",
  remove: "excluiu",
  deactivate: "desativou",
  activate: "ativou",
  redeem: "validou",
  claim: "pegou",
  status: "mudou a situação de",
  change_status: "mudou a situação de",
  changeStatus: "mudou a situação de",
  reset_password: "gerou senha provisória para",
  resetPassword: "gerou senha provisória para",
  publish: "publicou",
  cancel: "cancelou",
  schedule: "agendou",
  send: "enviou",
  block: "bloqueou",
  unblock: "desbloqueou",
  anonymize: "anonimizou",
  reorder: "reordenou",
  replace_tiers: "trocou as faixas de",
  replaceTiers: "trocou as faixas de",
  expire: "expirou",
  locate: "posicionou no mapa",
  approve: "aprovou",
  reject: "recusou",
  deliver: "entregou",
  // Troca no balcão (prize.redeem_counter, entidade prize_redemption): "fez a troca do clube ABC123".
  redeem_counter: "fez",
  archive: "arquivou",
  unarchive: "desarquivou",
  pause: "pausou",
  resume: "retomou",
  duplicate: "duplicou",
  earn: "ganhou",
  to_draft: "voltou para rascunho",
  reorder_challenges: "reordenou os desafios de",
  postpone: "adiou",
  close: "encerrou",
  undeliver: "desfez a entrega de",
  register: "cadastrou",
};

/** Verbo próprio de uma ação específica (o genérico não serve). */
const ACTION_VERBS: Record<string, string> = {
  "prize_redemption.cancel": "desfez",
};

/** Frases inteiras para as ações que não seguem "verbo + item". */
const PHRASES: Record<string, string> = {
  "auth.login": "entrou no painel",
  "auth.logout": "saiu do painel",
  "visitor.login": "entrou no app",
  "visitor.register": "se cadastrou no app",
  "visitor.update_profile": "editou o próprio perfil no app",
  "visitor.password_reset": "trocou a senha do app",
  "user.change_password": "trocou a própria senha",
  "setting.update": "editou as configurações do app",
  "upload.create": "enviou uma imagem",
  "highlight.reorder": "reordenou os destaques",
  "recycling_item.reorder": "reordenou os itens do Sustentarp",
  "art_point.reorder": "reordenou o Circuito Cultural",
  "store_category.reorder": "reordenou as categorias de loja",
};

const FIELD_LABEL: Record<string, string> = {
  name: "Nome",
  title: "Título",
  label: "Nome",
  shortLabel: "Sigla",
  level: "Nível",
  slug: "Endereço no app",
  description: "Descrição",
  status: "Situação",
  icon: "Ícone",
  brandColor: "Cor da marca",
  coverImageUrl: "Foto de capa",
  logoUrl: "Logo",
  imageUrl: "Imagem",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  website: "Site",
  mapX: "Posição no mapa (horizontal)",
  mapY: "Posição no mapa (vertical)",
  x: "Posição horizontal",
  y: "Posição vertical",
  hours: "Horários",
  layout: "Desenho do mapa",
  categoryId: "Categoria",
  blockId: "Bloco",
  floorId: "Andar",
  storeId: "Loja",
  storeIds: "Lojas",
  roleId: "Cargo",
  campaignId: "Campanha",
  sealId: "Selo",
  couponId: "Promoção",
  eventId: "Evento",
  prizeId: "Prêmio",
  email: "E-mail",
  permissions: "Permissões",
  sortOrder: "Ordem",
  kind: "Tipo",
  startsAt: "Início",
  endsAt: "Fim",
  totalQuantity: "Quantidade",
  redeemWindowHours: "Prazo para usar (h)",
  expiresWithPromotion: "Vence com a promoção",
  useUntil: "Vence em (data fixa)",
  headline: "Chamada",
  headlineSub: "Complemento da chamada",
  scheduleNote: "Observação de horário",
  savingsCents: "Economia estimada",
  weekdays: "Dias da semana",
  review: "Revisão da ARP",
  reviewNote: "Motivo da recusa",
  points: "Trevos",
  stock: "Estoque",
  active: "Ativo",
  validityMonths: "Validade (meses)",
  repeatable: "Pode repetir",
  validation: "Como valida",
  howTo: "Como cumprir",
  product: "Produto",
  threshold: "Selos para a faixa",
  tiers: "Faixas",
  validFrom: "Vale de",
  validUntil: "Vale até",
  ttlSeconds: "Prazo do QR",
  rotating: "Modo telão",
  body: "Mensagem",
  audience: "Público",
  deepLink: "Abre no app",
  scheduledAt: "Agendada para",
  recipientsCount: "Destinatários",
  subtitle: "Subtítulo",
  ctaLabel: "Texto do botão",
  badge: "Selo do destaque",
  targetType: "Leva para",
  targetUrl: "Link",
  sponsorStoreId: "Loja patrocinadora",
  place: "Local",
  recurrence: "Repetição",
  startsOn: "Começa em",
  endsOn: "Termina em",
  weekday: "Dia da semana",
  startTime: "Horário de início",
  endTime: "Horário de fim",
  awardsSeal: "Dá selo",
  marketingOptIn: "Aceita ofertas",
  blockedReason: "Motivo do bloqueio",
  reason: "Motivo",
  code: "Código",
  couponDefaultWindowHours: "Prazo padrão do cupom (h)",
  supportWhatsapp: "WhatsApp do suporte",
  supportEmail: "E-mail do suporte",
  aboutText: "Sobre a ARP",
  termsUrl: "Termos de uso",
  privacyUrl: "Privacidade",
  parkingInfo: "Estacionamento",
  tourInfo: "Tour da ARP",
  jobDays: "Dias de uma vaga no ar",
  trevosValidUntil: "Validade dos Trevos",
  trevosCountFrom: "Trevos contam a partir de",
  pointsExpiryNoticeDays: "Aviso antes de vencer os Trevos",
  mustChangePassword: "Precisa trocar a senha",
};

/** Campos que são só técnicos: não aparecem na expansão. */
const HIDDEN_FIELDS = new Set([
  "id",
  "isSystem",
  "isDemo",
  "createdAt",
  "updatedAt",
  "createdBy",
  "passwordHash",
  "rotationSecret",
  "token",
  "tokenHash",
  "lastLoginAt",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const entityLabel = (type: string) => NOUNS[type]?.label ?? "item";

/**
 * O que a pessoa fez, sem o nome dela nem o do item: "criou a campanha",
 * "entrou no painel". `withItem` diz se o nome do item vem depois.
 */
export function actionPhrase(log: AuditLog): { text: string; withItem: boolean } {
  const phrase = PHRASES[log.action];
  if (phrase) return { text: phrase, withItem: false };
  const verb = log.action.split(".")[1] ?? log.action;
  const noun = NOUNS[log.entityType];
  // Ação nova sem tradução: "alterou" (nunca o código cru).
  const v = ACTION_VERBS[log.action] ?? VERBS[verb] ?? "alterou";
  if (!noun) return { text: v, withItem: true };
  // "mudou a situação de" + "a promoção" → "mudou a situação da promoção".
  const item = `${noun.article} ${noun.label.toLowerCase()}`;
  const text = v.endsWith(" de") ? `${v.slice(0, -3)} d${item}` : `${v} ${item}`;
  return { text, withItem: true };
}

/** Versão antiga (só o verbo), usada em outros lugares. */
export function actionLabel(action: string): string {
  const [, verb = action] = action.split(".");
  return VERBS[verb] ?? "alterou";
}

export const fieldLabel = (field: string) => FIELD_LABEL[field] ?? null;

/** Tela do item, quando existe uma (o histórico vira um atalho). */
export function entityHref(log: AuditLog): string | null {
  const id = log.entityId;
  if (!id) return null;
  switch (log.entityType) {
    case "store":
      return PATHS.store(id);
    case "user":
      return PATHS.user(id);
    case "role":
      return PATHS.role(id);
    case "floor":
      return PATHS.map(id);
    case "coupon":
      return PATHS.coupon(id);
    case "campaign":
      return PATHS.campaign(id);
    case "challenge":
      return PATHS.challenge(id);
    case "event":
      return PATHS.event(id);
    case "highlight":
      return PATHS.highlight(id);
    case "notification":
      return PATHS.notification(id);
    case "visitor":
      return PATHS.visitor(id);
    case "prize":
      return PATHS.club();
    case "settings":
    case "setting":
      return PATHS.settings;
    default:
      return null;
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Um valor do diff em texto curto e legível (nada de código interno). */
export function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "vazio";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    if (UUID.test(v)) return "outro item";
    if (ISO.test(v)) return formatDateTime(v);
    return v.length > 120 ? `${v.slice(0, 117)}…` : v;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return "nenhum";
    if (v.every((x) => typeof x === "string" || typeof x === "number")) {
      if (v.some((x) => typeof x === "string" && UUID.test(x))) return `${v.length} itens`;
      const text = v.join(", ");
      return text.length > 120 ? `${v.length} itens` : text;
    }
    return `${v.length} itens`;
  }
  return "alterado";
}

export type ChangeRow = {
  field: string;
  label: string;
  from?: unknown;
  to: unknown;
  kind: "diff" | "value";
};

/**
 * Edições trazem { campo: { from, to } }; criações, o retrato do que foi
 * criado. Só campos de negócio com rótulo em português (o resto é técnico).
 */
export function changeRows(changes: AuditLog["changes"]): ChangeRow[] {
  if (!changes) return [];
  const rows: ChangeRow[] = [];
  for (const [field, v] of Object.entries(changes)) {
    const label = fieldLabel(field);
    if (!label || HIDDEN_FIELDS.has(field)) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && "to" in v) {
      rows.push({ field, label, from: "from" in v ? v.from : undefined, to: v.to, kind: "diff" });
    } else {
      rows.push({ field, label, to: v, kind: "value" });
    }
  }
  return rows;
}
