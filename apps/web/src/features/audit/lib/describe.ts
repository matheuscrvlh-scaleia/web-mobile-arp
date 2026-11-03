import type { AuditLog } from "@arp/contracts";
import { PATHS } from "@/shared/config/paths";
import { formatDateTime } from "@/shared/lib/format";

// Tradução do registro técnico (store.update, { brandColor: {from, to} })
// para algo que a equipe lê: "Loja · editou", "Cor da marca: #fff → #000".

export const ENTITY_LABEL: Record<string, string> = {
  store: "Loja",
  store_category: "Categoria de loja",
  storeCategory: "Categoria de loja",
  block: "Bloco",
  floor: "Andar",
  map_point: "Ponto do mapa",
  art_point: "Ponto do Circuito Cultural",
  recycling_item: "Item do Sustentarp",
  content_page: "Texto da ARP",
  job: "Vaga",
  mapPoint: "Ponto do mapa",
  coupon: "Promoção",
  claim: "Cupom pego",
  coupon_claim: "Cupom pego",
  seal: "Selo",
  campaign: "Campanha",
  challenge: "Desafio",
  qr_code: "QR Code",
  qrCode: "QR Code",
  event: "Evento",
  event_category: "Categoria de evento",
  eventCategory: "Categoria de evento",
  highlight: "Destaque",
  notification: "Notificação",
  visitor: "Visitante",
  user: "Usuário",
  role: "Cargo",
  settings: "Configurações",
  session: "Acesso",
  auth: "Acesso",
};

const VERBS: Record<string, string> = {
  create: "criou",
  update: "editou",
  delete: "apagou",
  remove: "apagou",
  deactivate: "desativou",
  activate: "ativou",
  redeem: "validou",
  claim: "pegou",
  status: "mudou a situação",
  change_status: "mudou a situação",
  changeStatus: "mudou a situação",
  reset_password: "gerou senha provisória",
  resetPassword: "gerou senha provisória",
  change_password: "trocou a senha",
  changePassword: "trocou a senha",
  login: "entrou",
  logout: "saiu",
  publish: "publicou",
  cancel: "cancelou",
  schedule: "agendou",
  send: "enviou",
  block: "bloqueou",
  unblock: "desbloqueou",
  reorder: "reordenou",
  award: "deu selo",
  replace_tiers: "trocou as faixas",
  replaceTiers: "trocou as faixas",
  expire: "expirou",
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
  mapX: "Posição X no mapa",
  mapY: "Posição Y no mapa",
  x: "Posição X",
  y: "Posição Y",
  hours: "Horários",
  layout: "Desenho do mapa",
  categoryId: "Categoria",
  blockId: "Bloco",
  floorId: "Andar",
  storeId: "Loja",
  roleId: "Cargo",
  email: "E-mail",
  permissions: "Permissões",
  sortOrder: "Ordem",
  kind: "Tipo",
  startsAt: "Início",
  endsAt: "Fim",
  totalQuantity: "Quantidade",
  redeemWindowHours: "Prazo para usar (h)",
  couponDefaultWindowHours: "Prazo padrão do cupom (h)",
  supportWhatsapp: "WhatsApp do suporte",
  supportEmail: "E-mail do suporte",
  aboutText: "Sobre a ARP",
  termsUrl: "Termos de uso",
  privacyUrl: "Privacidade",
  parkingInfo: "Estacionamento",
  tourInfo: "Tour da ARP",
  jobDays: "Dias de uma vaga no ar",
  pointsValidityMonths: "Meses de validade dos pontos",
  pointsExpiryNoticeDays: "Aviso antes de vencer os pontos",
  mustChangePassword: "Precisa trocar a senha",
  code: "Código",
};

export const entityLabel = (type: string) => ENTITY_LABEL[type] ?? type;

export function actionLabel(action: string): string {
  const [, verb = action] = action.split(".");
  return VERBS[verb] ?? verb.replace(/[_-]/g, " ");
}

export const fieldLabel = (field: string) => FIELD_LABEL[field] ?? field;

/** Tela do item, quando existe uma (o histórico vira um atalho). */
export function entityHref(log: AuditLog): string | null {
  if (!log.entityId) return null;
  switch (log.entityType) {
    case "store":
      return PATHS.store(log.entityId);
    case "user":
      return PATHS.user(log.entityId);
    case "role":
      return PATHS.role(log.entityId);
    case "floor":
      return PATHS.map(log.entityId);
    default:
      return null;
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Um valor do diff em texto curto e legível. */
export function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "vazio";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    if (ISO.test(v)) return formatDateTime(v);
    return v.length > 120 ? `${v.slice(0, 117)}…` : v;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return "nenhum";
    if (v.every((x) => typeof x === "string" || typeof x === "number")) {
      const text = v.join(", ");
      return text.length > 120 ? `${v.length} itens` : text;
    }
    return `${v.length} itens`;
  }
  const json = JSON.stringify(v);
  return json.length > 120 ? `${json.slice(0, 117)}…` : json;
}

export type ChangeRow = { field: string; from?: unknown; to: unknown; kind: "diff" | "value" };

/** Edições trazem { campo: { from, to } }; criações, o retrato do que foi criado. */
export function changeRows(changes: AuditLog["changes"]): ChangeRow[] {
  if (!changes) return [];
  return Object.entries(changes).map(([field, v]) => {
    if (v && typeof v === "object" && !Array.isArray(v) && "to" in v) {
      return { field, from: "from" in v ? v.from : undefined, to: v.to, kind: "diff" };
    }
    return { field, to: v, kind: "value" };
  });
}
