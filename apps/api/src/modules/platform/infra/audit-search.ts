// Busca do Histórico em português: a tela mostra "Maria excluiu a campanha
// Natal", mas o banco guarda "campaign.delete". Cada palavra digitada vira
// os códigos que ela descreve (tipo do item e verbo da ação).

/** Palavras (sem acento, minúsculas) de cada tipo de item, como a tela escreve. */
const ENTITY_WORDS: Record<string, string[]> = {
  store: ["loja"],
  store_category: ["categoria de loja", "categoria"],
  block: ["bloco"],
  floor: ["andar", "mapa"],
  map_point: ["ponto do mapa", "mapa"],
  art_point: ["circuito cultural", "ponto do circuito"],
  recycling_item: ["sustentarp", "reciclagem"],
  content_page: ["texto do app", "conteudo"],
  job: ["vaga"],
  coupon: ["promocao", "cupom"],
  claim: ["cupom pego", "cupom"],
  seal: ["selo"],
  earned_seal: ["selo"],
  campaign: ["campanha"],
  challenge: ["desafio"],
  qr_code: ["qr code", "qr"],
  prize: ["premio", "clube", "lojinha"],
  prize_redemption: ["troca do clube", "troca", "clube"],
  event: ["evento"],
  event_category: ["categoria de evento", "categoria"],
  highlight: ["destaque"],
  notification: ["notificacao", "push"],
  visitor: ["visitante"],
  user: ["usuario"],
  role: ["cargo", "permissao"],
  merchant_invite: ["link de cadastro", "lojista"],
  merchant_signup: ["cadastro de lojista", "lojista"],
  setting: ["configuracoes", "configuracao"],
  upload: ["imagem", "foto"],
  auth: ["acesso", "login", "painel"],
};

/** Formas do verbo (sem acento) de cada sufixo de ação (coupon.<sufixo>). */
const VERB_WORDS: Record<string, string[]> = {
  create: ["criou", "criar", "criado", "criacao", "novo", "nova"],
  register: ["cadastrou", "cadastro"],
  update: ["editou", "editar", "alterou", "alterar", "mudou", "edicao"],
  update_profile: ["editou", "perfil"],
  delete: ["excluiu", "excluir", "excluido", "exclusao", "apagou"],
  remove: ["excluiu", "excluir", "removeu"],
  anonymize: ["anonimizou", "anonimizar", "anonimizado", "lgpd"],
  deactivate: ["desativou", "desativar", "desativado"],
  activate: ["ativou", "ativar", "reativou"],
  redeem: ["validou", "validar", "usou"],
  redeem_counter: ["trocou", "troca", "balcao"],
  claim: ["pegou"],
  change_status: ["mudou a situacao", "situacao", "status"],
  reset_password: ["senha"],
  change_password: ["senha"],
  password_reset: ["senha"],
  publish: ["publicou", "publicar"],
  cancel: ["cancelou", "cancelar", "desfez"],
  schedule: ["agendou", "agendar"],
  send: ["enviou", "enviar", "disparou"],
  block: ["bloqueou", "bloquear"],
  unblock: ["desbloqueou", "desbloquear"],
  reorder: ["reordenou", "ordem"],
  reorder_challenges: ["reordenou", "ordem"],
  replace_tiers: ["faixas"],
  locate: ["posicionou", "mapa"],
  approve: ["aprovou", "aprovar"],
  reject: ["recusou", "recusar"],
  deliver: ["entregou", "entregar"],
  undeliver: ["desfez"],
  archive: ["arquivou", "arquivar"],
  unarchive: ["desarquivou", "desarquivar"],
  pause: ["pausou", "pausar"],
  resume: ["retomou", "retomar"],
  duplicate: ["duplicou", "duplicar", "copia"],
  earn: ["ganhou"],
  to_draft: ["rascunho", "voltou"],
  postpone: ["adiou", "adiar"],
  close: ["encerrou", "encerrar"],
  login: ["entrou", "login"],
  logout: ["saiu"],
};

/** Palavras que não ajudam a achar nada ("quem excluiu a campanha"). */
const STOPWORDS = new Set([
  "a",
  "o",
  "as",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "na",
  "no",
  "um",
  "uma",
  "quem",
  "que",
]);

export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "campanhas" acha "campanha"; "exclu" acha "excluiu". */
const matches = (term: string, token: string) =>
  token.length >= 3 && (term.includes(token) || token.startsWith(term));

function codesFor(dict: Record<string, string[]>, token: string): string[] {
  return Object.entries(dict)
    .filter(([, words]) => words.some((w) => matches(w, token)))
    .map(([code]) => code);
}

export interface AuditSearchToken {
  text: string;
  entityTypes: string[];
  verbs: string[];
}

/** Quebra a busca em palavras, cada uma com os códigos que ela pode significar. */
export function auditSearchTokens(q: string): AuditSearchToken[] {
  const words = fold(q)
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
  // Só palavras vazias ("a", "de"): busca o texto inteiro.
  const list = words.length > 0 ? words : [q.trim()];
  return list.map((text) => ({
    text,
    entityTypes: codesFor(ENTITY_WORDS, text),
    verbs: codesFor(VERB_WORDS, text),
  }));
}
