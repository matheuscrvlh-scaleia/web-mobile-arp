import type { Step } from "./types";

// Passos que se repetem de tela em tela. Cada tela pode trocar o texto para
// dizer o que aquele filtro, aba ou lista tem de próprio.

export const opening = (title: string, text: string): Step => ({ title, text });

/** Passo no centro da tela, para o que não tem um ponto fixo (ex.: o resultado). */
export const note = (title: string, text: string): Step => ({ title, text });

export const actions = (text: string): Step => ({
  target: "acoes",
  title: "Ações da tela",
  text,
});

export const tabs = (
  text = "A tela se divide em abas. A aba fica no endereço: mande o link e a outra pessoa abre na mesma.",
): Step => ({
  target: "abas",
  title: "Abas",
  text,
});

export const filters = (
  text = "Recorte a lista. O filtro fica no endereço: mande o link e a outra pessoa vê o mesmo recorte.",
): Step => ({ target: "filtros", title: "Filtros", text });

export const search = (text = "Digite parte do nome para filtrar a lista."): Step => ({
  target: "busca",
  title: "Busca",
  text,
});

export const table = (
  text = "Os registros, um por linha. Clique numa linha para abrir; o menu <b>⋯</b> no fim da linha tem as outras ações.",
): Step => ({ target: "tabela", title: "Lista", text });

/** A primeira linha da lista: como abrir um registro. */
export const row = (title: string, text: string): Step => ({ target: "linha", title, text });

/** O primeiro menu "⋯" (na lista) ou "Mais" (no detalhe). */
export const rowMenu = (text: string, title = "Mais ações"): Step => ({
  target: "menu-acoes",
  title,
  text,
});

/** Um bloco do formulário, pelo título dele ("Quando vale" → "quando-vale"). */
export const section = (slug: string, title: string, text: string): Step => ({
  target: `secao-${slug}`,
  title,
  text,
});

/** O botão de criar que fica dentro do cartão (Novo prêmio, Nova categoria…). */
export const create = (title: string, text: string): Step => ({ target: "criar", title, text });

export const cards = (text: string): Step => ({ target: "cartoes", title: "Indicadores", text });

export const preview = (
  text = "Como o visitante vai ver no app. Muda na hora, enquanto você preenche.",
): Step => ({ target: "previa", title: "Prévia no celular", text });

/** O que vale para todo formulário do painel. */
export const saving = (
  text = "Os campos com <b>*</b> são obrigatórios. Ao mudar algo, aparece a barra <b>Alterações não salvas</b> embaixo, com Salvar e Desfazer. Se a sessão cair no meio, o que você digitou volta depois do login.",
): Step => note("Salvar", text);

/** Primeira visita ao módulo: as telas dele no menu. */
export const menuSection = (text: string): Step => ({
  target: "menu-modulo",
  title: "Telas desta seção",
  text,
});

export const quickSearch = (): Step => ({
  target: "busca-telas",
  title: "Ir direto para uma tela",
  text: "Digite o nome de uma tela, loja, promoção ou visitante e aperte Enter. Atalho: <b>Ctrl K</b>, de qualquer lugar do painel.",
});

/** Último passo de todo guia: onde reabrir. */
export const closing: Step = {
  target: "guia",
  title: "Reveja quando quiser",
  text: "Este botão abre o guia da tela em que você estiver. Atalho: tecla <b>?</b>. Quando um guia muda, aparece um ponto verde aqui.",
};
