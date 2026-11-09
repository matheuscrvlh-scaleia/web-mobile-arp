/**
 * Pontos da tela onde um passo do guia pode apontar (como no copiloto). Cada
 * um é um atributo `data-guia` num componente comum (título, filtros, abas,
 * lista…), então toda tela que usa o componente já tem o ponto. Para apontar
 * para algo só daquela tela, ponha `data-guia="<nome>"` no elemento e
 * acrescente o nome aqui.
 */
export type Target =
  // Moldura (iguais em todas as telas)
  | "menu"
  | "menu-modulo"
  | "onde-estou"
  | "busca-telas"
  | "avisos"
  | "guia"
  // Componentes das telas
  | "titulo"
  | "acoes"
  | "abas"
  | "filtros"
  | "busca"
  | "tabela"
  /** Primeira linha da lista (na lista em cartões, o primeiro item). */
  | "linha"
  /** O primeiro menu "⋯" / "Mais" visível. */
  | "menu-acoes"
  | "cartoes"
  /** Um bloco de formulário (FormSection), pelo título: "Quando vale" → "secao-quando-vale". */
  | `secao-${string}`
  // Pontos de uma tela só
  | "pendencias"
  | "codigo"
  | "resultado"
  | "recentes"
  | "mapa"
  | "andares"
  | "planta"
  | "salvar-desenho"
  | "sem-lugar"
  | "previa"
  | "checklist"
  | "pendencias-loja"
  | "copiar-horarios"
  | "validar"
  | "aprovar"
  | "ativo-no-app"
  | "criar"
  | "cartazes"
  | "desfazer-troca"
  | "envio"
  | "regras"
  | "link-convite"
  | "rascunhos";

export interface Step {
  /** Sem alvo, o passo aparece no centro da tela (abertura, resumo). */
  target?: Target;
  title: string;
  /** Aceita <b> para destacar; é texto fixo do sistema, nunca dado de usuário. */
  text: string;
}

export interface Guide {
  /** Suba ao mudar o guia: quem já tinha visto volta a ver o ponto de novidade. */
  version: number;
  steps: Step[];
}
