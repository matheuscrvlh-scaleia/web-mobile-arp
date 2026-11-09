import {
  actions,
  cards,
  filters,
  menuSection,
  note,
  opening,
  preview,
  quickSearch,
  saving,
  search,
  table,
  tabs,
} from "./common";
import type { Guide } from "./types";

/*
 * Um guia por tela, pela rota (as de PATHS). `:id` vale o id de um registro e
 * a query na chave é obrigatória (Aprovar cupons). Subtela sem guia próprio
 * usa o da tela-mãe. Passo cujo ponto não está na tela (sem permissão, sem
 * dado, lojista) é pulado na hora de abrir.
 */
export const GUIDES: Record<string, Guide> = {
  /* Início ---------------------------------------------------------------- */
  "/dashboard": {
    version: 1,
    steps: [
      opening(
        "Boas-vindas ao painel da ARP",
        "Aqui você cuida do app do visitante: lojas, promoções, selos, clube, avisos e conteúdo. Este guia mostra onde fica cada coisa em menos de um minuto.",
      ),
      {
        target: "menu",
        title: "Menu",
        text: "Cada assunto é uma seção. Você só vê as telas que o seu cargo libera. Clique no nome da seção para recolher ou abrir; o número em amarelo é o que espera por você.",
      },
      quickSearch(),
      {
        target: "onde-estou",
        title: "Onde você está",
        text: "Seção e tela atuais, sempre no topo.",
      },
      {
        target: "avisos",
        title: "Tema e pendências",
        text: "Alterne entre claro e escuro. O sino junta o que espera por você, como cupons e lojistas para aprovar.",
      },
      {
        target: "pendencias",
        title: "Pendências",
        text: "O que precisa da sua atenção agora. Clique num item para ir direto à tela que resolve.",
      },
      filters(
        "Escolha o período (7, 30 ou 90 dias) e, se quiser, uma loja. Os números e os gráficos recalculam na hora.",
      ),
      cards(
        "Os números do período, com a variação contra o período anterior: a seta diz se subiu ou caiu e a cor, se isso é bom. Clique num cartão para ver de onde vem o número.",
      ),
      note(
        "Gráficos",
        "Mais abaixo: o movimento por dia, a hora em que os cupons são usados no caixa e o resultado das leituras de QR Code.",
      ),
    ],
  },

  /* Balcão ---------------------------------------------------------------- */
  "/cupons/validar": {
    version: 1,
    steps: [
      opening(
        "Validar cupom",
        "O visitante mostra o cupom no app (código ARP-XXXXXX e QR). Aqui você confere as condições e dá baixa no caixa.",
      ),
      menuSection("O Balcão reúne o atendimento ao visitante. Deixe esta tela aberta no caixa."),
      {
        target: "codigo",
        title: "Código do cupom",
        text: "O <b>ARP-</b> já vem escrito: digite as 6 letras e números ou cole o código. Com câmera, <b>Ler QR</b> preenche sozinho.",
      },
      note(
        "Conferir e validar",
        "Aparecem a promoção, a loja e as condições de uso. Se estiver tudo certo, valide: o cupom fica usado e não vale de novo.",
      ),
      actions(
        "<b>Cupons pegos</b> abre a lista de todos os cupons: quem pegou, quando e se já usou.",
      ),
    ],
  },
  "/clube/trocar": {
    version: 1,
    steps: [
      opening(
        "Trocar pontos",
        "O visitante troca os pontos dos selos por um prêmio da lojinha, aqui no balcão. São três passos, e o prêmio sai entregue na hora.",
      ),
      search(
        "<b>1. Visitante</b>: busque pelo nome, e-mail ou telefone que ele usa no app (2 letras ou mais) e confira o saldo de pontos.",
      ),
      note(
        "2. Prêmio e 3. Confirmar",
        "Só dá para escolher prêmio que tem no estoque e que o saldo cobre. Confirme e entregue: os pontos saem do saldo na hora.",
      ),
    ],
  },

  /* Lojas ----------------------------------------------------------------- */
  "/lojas": {
    version: 1,
    steps: [
      opening(
        "Lojas",
        "O guia de lojas e alimentação do app: dados, horários, lugar no mapa e desempenho de cada loja.",
      ),
      menuSection(
        "Nesta seção ficam também o Mapa, as Categorias e blocos e os Lojistas (o acesso das lojas ao painel).",
      ),
      actions("Troque entre <b>Cartões</b> e <b>Tabela</b> e cadastre uma <b>Nova loja</b>."),
      filters(
        "Busque por nome, categoria ou descrição e recorte por tipo, categoria, andar, bloco e situação. Em <b>Cadastro</b>, ache as lojas sem horário, sem foto, sem logo ou fora do mapa.",
      ),
      table(
        "Clique numa loja para abrir. O menu <b>⋯</b> tem Ver no mapa e Desativar. Marque várias para agir de uma vez.",
      ),
    ],
  },
  "/lojas/nova": {
    version: 1,
    steps: [
      opening(
        "Nova loja",
        "Preencha os dados da loja. Depois de criar, defina os horários e o ponto no mapa, nas abas da própria loja.",
      ),
      saving(),
    ],
  },
  "/lojas/:id": {
    version: 1,
    steps: [
      opening(
        "Página da loja",
        "Tudo de uma loja numa tela só. Para o lojista, é a <b>Minha loja</b>: o que aparece no guia do app.",
      ),
      tabs(
        "<b>Dados</b>: nome, fotos e descrição. <b>Horários</b>: quando abre. <b>Localização</b>: o ponto no mapa. <b>Equipe</b>: quem da loja acessa o painel. <b>Desempenho</b>: cupons e selos da loja. Você só vê as abas que o seu cargo libera.",
      ),
      saving(),
    ],
  },
  "/mapa": {
    version: 1,
    steps: [
      opening(
        "Mapa",
        "O mapa por andar do app: o desenho, os pinos das lojas e os pontos de referência.",
      ),
      {
        target: "andares",
        title: "Andares",
        text: "Troque de andar aqui. Se houver algo sem salvar, o painel pergunta antes de trocar.",
      },
      {
        target: "mapa",
        title: "O andar",
        text: "Arraste um pino para mudar o lugar da loja ou do ponto. Errou? Use o <b>Desfazer</b> do aviso.",
      },
      tabs(
        "<b>Lojas e pontos</b>: posicione os pinos e cadastre pontos de referência. <b>Desenho</b>: o desenho do andar.",
      ),
    ],
  },
  "/categorias": {
    version: 1,
    steps: [
      opening("Categorias e blocos", "Os cadastros que organizam o guia de lojas do app."),
      tabs(
        "<b>Categorias de loja</b>, separadas por tipo (cada uma vira um filtro no app), e <b>Blocos</b>, os prédios da ARP usados no “onde fica” de cada loja.",
      ),
      note(
        "Ordem e exclusão",
        "A ordem da lista é a do app: arraste um item ou use as setas. Ao excluir uma categoria com lojas, o painel pergunta para onde mover as lojas.",
      ),
    ],
  },
  "/lojistas": {
    version: 1,
    steps: [
      opening(
        "Lojistas",
        "O acesso das lojas ao painel. O lojista se cadastra por um link e só entra depois que a ARP aprova; o aviso vai por e-mail. A equipe de cada loja também aparece na página da loja, aba Equipe.",
      ),
      note(
        "Link de cadastro",
        "Escolha a loja e <b>Gere o link</b>. Ele vale 7 dias e serve para mais de uma pessoa da mesma loja: copie ou <b>Envie por WhatsApp</b>. Em <b>Links ativos</b>, cancele o que foi para a pessoa errada.",
      ),
      table(
        "<b>Cadastros</b>: confira a loja e o e-mail antes de <b>Aprovar</b> ou <b>Recusar</b>. Filtre pela situação acima da lista.",
      ),
    ],
  },

  /* Promoções ------------------------------------------------------------- */
  "/cupons": {
    version: 1,
    steps: [
      opening(
        "Promoções",
        "Os cupons das lojas no app. O visitante pega o cupom, recebe um código único (ARP-XXXXXX) e mostra no caixa, onde a loja valida.",
      ),
      menuSection(
        "Nesta seção ficam também os cupons pegos pelos visitantes e, para a equipe da ARP, os cupons que esperam aprovação.",
      ),
      actions("Troque entre <b>Cartões</b> e <b>Tabela</b> e crie uma <b>Nova promoção</b>."),
      filters(
        "Busque pelo nome e recorte por loja, situação e revisão da ARP. Em <b>Ordenar</b>, veja as que terminam primeiro, as mais usadas ou as com menos cupons restantes.",
      ),
      table(
        "Cada promoção mostra a situação, quantos cupons restam e quantos foram usados. Clique para abrir; o menu <b>⋯</b> tem Editar, Duplicar, Encerrar e Arquivar.",
      ),
      note(
        "Revisão da ARP",
        "Cupom criado ou alterado por lojista só vai ao app depois que a ARP aprova. Recusado, o lojista vê o motivo.",
      ),
    ],
  },
  "/cupons?review=pending": {
    version: 1,
    steps: [
      opening(
        "Aprovar cupons",
        "Cupons criados ou alterados por lojistas, esperando a ARP conferir. Aprovado, vai ao app quando estiver publicado; recusado, o lojista vê o motivo.",
      ),
      filters("Busque pelo nome ou recorte por loja."),
      table(
        "Confira texto, regras e estoque de cada cupom e use <b>Aprovar</b> ou <b>Recusar</b>. O número no menu mostra quantos ainda esperam.",
      ),
    ],
  },
  "/cupons/nova": {
    version: 1,
    steps: [
      opening(
        "Nova promoção",
        "Monte o cupom: loja, texto, estoque, período e as regras de uso, como os dias da semana e o prazo para usar depois de pegar.",
      ),
      preview(),
      saving(),
    ],
  },
  "/cupons/:id": {
    version: 1,
    steps: [
      opening("Promoção", "A promoção como está no app, as regras e quem já pegou o cupom."),
      actions(
        "Editar, pausar ou retomar, duplicar e, no menu, encerrar, arquivar ou excluir. Encerrada, a promoção não muda mais: duplique para fazer outra igual.",
      ),
      preview(),
      table("Cupons pegos desta promoção: quem pegou, quando e se já usou."),
    ],
  },
  "/cupons/:id/editar": {
    version: 1,
    steps: [
      opening(
        "Editar promoção",
        "Mude o que precisar. Se quem altera é o lojista, o cupom volta para a aprovação da ARP.",
      ),
      preview(),
      saving(),
    ],
  },
  "/cupons/pegos": {
    version: 1,
    steps: [
      opening("Cupons pegos", "Quem pegou cada cupom, quando e se já usou no caixa."),
      actions("Baixe a lista em CSV."),
      filters("Busque pelo código ou visitante e recorte por loja, promoção e situação."),
      table(
        "Um cupom por linha. O cupom ainda não usado tem a ação <b>Validar</b>, que abre o Validar cupom já com o código.",
      ),
    ],
  },

  /* Selos ----------------------------------------------------------------- */
  "/campanhas": {
    version: 1,
    steps: [
      opening(
        "Campanhas",
        "As campanhas mensais de selos. Cada campanha tem desafios (o que o visitante faz, como ler um QR Code), cada desafio dá um selo, e as faixas de benefício premiam quem junta selos.",
      ),
      menuSection("Nesta seção ficam as Campanhas (com os desafios dentro) e a coleção de Selos."),
      actions(
        "Crie uma <b>Nova campanha</b>. Ela nasce em rascunho, fora do app, até você publicar.",
      ),
      search("Procure a campanha pelo nome."),
      tabs("Filtre pela situação da campanha."),
      table(
        "Clique numa campanha para abrir. O menu <b>⋯</b> tem Duplicar para o próximo mês, Arquivar e Excluir.",
      ),
    ],
  },
  "/campanhas/nova": {
    version: 1,
    steps: [
      opening(
        "Nova campanha",
        "Ela nasce em rascunho, fora do app. Depois de criar, cadastre os desafios e as faixas de benefício e publique.",
      ),
      saving(),
    ],
  },
  "/campanhas/:id": {
    version: 1,
    steps: [
      opening("Campanha", "Tudo da campanha: como está indo, os desafios e os benefícios."),
      actions(
        "Publique ou despublique a campanha. No menu, <b>Duplicar para o próximo mês</b> poupa o recadastro.",
      ),
      tabs(
        "<b>Resumo</b>: como a campanha está indo. <b>Desafios</b>: o que dá cada selo. <b>Faixas de benefício</b>: o que o visitante ganha juntando selos. <b>Dados</b>: nome e período.",
      ),
    ],
  },
  "/desafios": {
    version: 1,
    steps: [
      opening(
        "Desafios",
        "O que o visitante faz para ganhar cada selo. Os desafios ficam dentro de uma campanha.",
      ),
      filters("Escolha a campanha para ver os desafios dela."),
      table("Clique num desafio para abrir os QR Codes e os dados."),
    ],
  },
  "/desafios/novo": {
    version: 1,
    steps: [
      opening("Novo desafio", "Cada desafio dá um selo. Depois de criar, gere o QR Code."),
      saving(),
    ],
  },
  "/desafios/:id": {
    version: 1,
    steps: [
      opening("Desafio", "Os QR Codes e os dados do desafio."),
      actions("No <b>Mais</b> ficam as outras ações do desafio."),
      tabs(
        "<b>QR Codes</b>: gere, imprima, baixe a imagem ou abra o telão. Cada QR mostra se está valendo, vencido ou revogado. <b>Dados do desafio</b>: o que o desafio pede e o selo que dá.",
      ),
    ],
  },
  "/selos": {
    version: 1,
    steps: [
      opening(
        "Selos",
        "A coleção de selos do app e quem já conquistou cada um. Cada selo vale pontos no Clube ARP.",
      ),
      actions("Crie um <b>Novo selo</b>."),
      tabs(
        "<b>Coleção</b>: todos os selos, como aparecem no app. <b>Conquistados</b>: quem ganhou qual selo e quando, com filtros por campanha, desafio e visitante.",
      ),
      table("Clique num selo para editar."),
    ],
  },

  /* Clube ARP ------------------------------------------------------------- */
  "/clube": {
    version: 1,
    steps: [
      opening(
        "Clube ARP",
        "Selos valem pontos, que o visitante troca por prêmios no balcão do Centro de Informações. O app mostra a lojinha e o ranking (só apelidos).",
      ),
      tabs(
        "<b>Lojinha</b>: os prêmios e o estoque. <b>Trocas</b>: o que já foi trocado. <b>Ranking</b>: quem tem mais pontos. Você só vê as abas que o seu cargo libera.",
      ),
      note(
        "Regras do clube",
        "O quadro de regras mostra quanto vale cada selo e por quanto tempo os pontos valem, com o atalho para mudar em Selos ou em Configurações.",
      ),
      table(
        "Na lojinha, <b>Já podem trocar</b> e <b>Perto (80%+)</b> ajudam a decidir quanto comprar de cada prêmio. <b>Novo prêmio</b> cadastra outro; o menu <b>⋯</b> tem Editar, Tirar da lojinha e Excluir.",
      ),
    ],
  },

  /* Comunicação ----------------------------------------------------------- */
  "/destaques": {
    version: 1,
    steps: [
      opening(
        "Destaques",
        "O carrossel do topo da home do app: destaques da ARP e mídia patrocinada, cada um com período e destino (um evento, um cupom, uma loja ou um link).",
      ),
      menuSection(
        "Comunicação reúne o que fala com o visitante: os Destaques, as Notificações push e a agenda de Eventos.",
      ),
      actions("Crie um <b>Novo destaque</b>."),
      cards(
        "O que está no ar agora: quantos slides o visitante vê hoje, as impressões e o CTR (cliques ÷ impressões).",
      ),
      filters("Busque pelo nome e recorte pela situação."),
      table(
        "A ordem da lista é a do carrossel: arraste para mudar. Clique num destaque para editar.",
      ),
    ],
  },
  "/destaques/novo": {
    version: 1,
    steps: [
      opening(
        "Novo destaque",
        "Escolha a imagem, o período e o destino do slide: um evento, um cupom, uma loja ou um link. Salve como rascunho ou publique.",
      ),
      preview(),
      saving(),
    ],
  },
  "/destaques/:id": {
    version: 1,
    steps: [
      opening("Destaque", "Como o slide está indo e os dados dele."),
      actions("Pause ou retome o slide; no <b>Mais</b> ficam as outras ações."),
      cards("Impressões, cliques e CTR (cliques ÷ impressões) deste destaque."),
      preview(),
      saving(),
    ],
  },
  "/notificacoes": {
    version: 1,
    steps: [
      opening("Notificações", "Push para quem tem o app: rascunhos, agendadas e enviadas."),
      actions(
        "Escreva uma <b>Nova notificação</b>. Ela fica como rascunho até você agendar ou enviar.",
      ),
      filters("Recorte pela situação e busque pelo título."),
      table(
        "Cada linha mostra o público e quantas pessoas recebem (estimativa, até o envio). Clique para abrir.",
      ),
    ],
  },
  "/notificacoes/nova": {
    version: 1,
    steps: [
      opening(
        "Nova notificação",
        "Título, texto, público e para onde o toque leva no app. Fica como rascunho; depois agende ou envie.",
      ),
      preview("Como a notificação aparece na tela bloqueada do celular."),
      saving(),
    ],
  },
  "/notificacoes/:id": {
    version: 1,
    steps: [
      opening(
        "Notificação",
        "Rascunho: ajuste o texto e o público, depois agende ou envie. Enviada: o que saiu, para quem e quando.",
      ),
      preview("Como a notificação aparece na tela bloqueada do celular."),
    ],
  },
  "/eventos": {
    version: 1,
    steps: [
      opening(
        "Eventos",
        "A agenda do app vem do site da ARP. Aqui você escolhe o que aparece no app; o que vem do site não se edita aqui.",
      ),
      actions(
        "<b>Sincronizar com o site</b> abre Integrações, que deixa a agenda igual à do site.",
      ),
      tabs(
        "<b>Lista</b>: todos os eventos, com busca e filtros. <b>Calendário</b>: os eventos do mês em grade. <b>Categorias</b>: as categorias da agenda do app.",
      ),
      filters("Busque pelo nome e recorte por categoria, situação, recorrência e datas."),
      table(
        "Clique num evento para ver os detalhes. <b>Mostrar no app</b> e <b>Não mostrar no app</b> decidem se ele aparece para o visitante.",
      ),
    ],
  },
  "/eventos/:id": {
    version: 1,
    steps: [
      opening(
        "Evento",
        "O evento como veio do site, só para leitura. Para mudar o texto ou a data, mude no site e sincronize.",
      ),
      actions(
        "Decida se o evento aparece no app: <b>Mostrar no app</b> ou <b>Não mostrar no app</b>.",
      ),
    ],
  },

  /* Conteúdo -------------------------------------------------------------- */
  "/conteudo": {
    version: 1,
    steps: [
      opening(
        "Conteúdo do app",
        "Textos da ARP, pontos do Circuito Cultural e o que o Sustentarp recebe. O app mostra o que está aqui.",
      ),
      menuSection("Conteúdo reúne os textos do app e as Vagas de emprego das lojas."),
      tabs(
        "<b>Textos</b>: história, regulamento, regras do clube e outros textos fixos. <b>Circuito Cultural</b>: obras, memórias, esculturas e murais, com o lugar no mapa. <b>Sustentarp</b>: o que a reciclagem recebe. Trocar de aba com algo sem salvar pede confirmação.",
      ),
      saving(),
    ],
  },
  "/vagas": {
    version: 1,
    steps: [
      opening(
        "Vagas",
        "Vagas de emprego das lojas. Ficam no menu do app e saem do ar sozinhas no prazo (padrão: 30 dias).",
      ),
      actions("<b>Publicar vaga</b> abre o formulário da vaga."),
      search("Busque pela vaga ou pela loja."),
      tabs("Veja as vagas <b>Ativas</b> ou as <b>Encerradas</b>."),
      table("Clique numa vaga para editar. O menu <b>⋯</b> tem Encerrar agora e Excluir."),
    ],
  },

  /* Pessoas --------------------------------------------------------------- */
  "/visitantes": {
    version: 1,
    steps: [
      opening("Usuários do app", "Quem usa o app: selos, cupons, economia e preferências."),
      menuSection(
        "Pessoas reúne os visitantes (quem usa o app) e os usuários do painel, com os cargos.",
      ),
      filters(
        "Busque por nome, e-mail ou celular e recorte pela situação (ativos ou bloqueados) e por quem aceita ofertas.",
      ),
      table("Clique num visitante para ver a conta."),
    ],
  },
  "/visitantes/:id": {
    version: 1,
    steps: [
      opening(
        "Visitante",
        "A conta de quem usa o app: selos, cupons pegos e usados, pontos e preferências.",
      ),
      note(
        "Bloquear e LGPD",
        "<b>Bloquear</b> tira a pessoa do app até você desbloquear. <b>Anonimizar dados</b> apaga nome, e-mail, telefone e foto quando a própria pessoa pede (LGPD), e não tem volta.",
      ),
    ],
  },
  "/usuarios": {
    version: 1,
    steps: [
      opening(
        "Usuários e cargos",
        "Quem acessa o painel: equipe da ARP e lojistas. O cargo define o que cada um vê e faz.",
      ),
      tabs("<b>Usuários</b> e <b>Cargos</b> são telas irmãs: troque por aqui."),
      actions("Dê acesso a alguém com <b>Novo usuário</b>."),
      cards("Quantas pessoas têm acesso, quantas estão desativadas e quantos cargos existem."),
      filters("Busque por nome ou e-mail e recorte por cargo e situação."),
      table("Clique numa pessoa para mudar o cargo, desativar ou redefinir a senha."),
    ],
  },
  "/usuarios/novo": {
    version: 1,
    steps: [
      opening(
        "Novo usuário",
        "O usuário nasce com uma senha provisória. Passe o e-mail e a senha para a pessoa por um canal seguro; no primeiro acesso, ela define a própria senha.",
      ),
      saving(),
    ],
  },
  "/usuarios/:id": {
    version: 1,
    steps: [
      opening(
        "Usuário",
        "Dados, cargo e situação de quem acessa o painel. Mudança de cargo vale no próximo acesso. Esqueceu a senha? <b>Redefinir senha</b> gera uma provisória.",
      ),
      saving(),
    ],
  },
  "/cargos": {
    version: 1,
    steps: [
      opening(
        "Cargos",
        "Cada cargo libera um conjunto de telas e ações. A mudança vale no próximo acesso de quem tem o cargo (até 15 min).",
      ),
      tabs("<b>Usuários</b> e <b>Cargos</b> são telas irmãs: troque por aqui."),
      actions("Crie um <b>Novo cargo</b>."),
      table("Clique num cargo para ver e mudar as permissões."),
    ],
  },
  "/cargos/novo": {
    version: 1,
    steps: [
      opening(
        "Novo cargo",
        "Dê um nome e marque o que o cargo pode ver e fazer. Cada permissão diz quais telas do menu ela libera; marcar “gerenciar” também libera o “ver” do mesmo assunto.",
      ),
      saving(),
    ],
  },
  "/cargos/:id": {
    version: 1,
    steps: [
      opening(
        "Cargo",
        "Marque o que o cargo pode ver e fazer. Cada permissão diz quais telas do menu ela libera; marcar “gerenciar” também libera o “ver” do mesmo assunto.",
      ),
      actions("No <b>Mais</b>: duplicar o cargo ou excluir (só quando ninguém tem o cargo)."),
      saving(),
    ],
  },

  /* Sistema --------------------------------------------------------------- */
  "/relatorios": {
    version: 1,
    steps: [
      opening(
        "Relatórios",
        "Qual promoção funcionou melhor, cupons por loja e selos dados no período.",
      ),
      menuSection(
        "Sistema reúne os Relatórios, o Histórico de alterações, as Integrações e as Configurações do app.",
      ),
      actions("<b>Exportar CSV</b> baixa o relatório."),
      filters("Escolha o período e, se quiser, uma loja."),
      cards(
        "Cupons pegos e usados, a taxa de uso (usados ÷ pegos) e a economia gerada para os visitantes.",
      ),
      tabs("<b>Cupons por promoção</b>, <b>Cupons por loja</b> e <b>Selos por loja e produto</b>."),
      table("Uma linha por promoção, loja ou selo, conforme a aba."),
    ],
  },
  "/historico": {
    version: 1,
    steps: [
      opening(
        "Histórico",
        "Tudo o que foi alterado no painel e no app: quem fez, quando e o que mudou.",
      ),
      filters(
        "Busque por nome ou ação e recorte pelo item, pela pessoa e pelo tipo de ação (criou, editou, mudou a situação, excluiu).",
      ),
      table("As alterações, das mais novas para as mais antigas. Cada entrada diz o que mudou."),
    ],
  },
  "/integracoes": {
    version: 1,
    steps: [
      opening(
        "Integrações",
        "Sistemas de fora que alimentam o app. O que vem deles não se edita no painel.",
      ),
      note(
        "Agenda do site",
        "<b>Sincronizar com o site</b> deixa a agenda igual à do espacoarp.com.br: evento novo lá entra aqui fora do app; editado lá, muda aqui; apagado lá, é apagado aqui. Antes, escolha a <b>categoria dos eventos novos</b> (o site não tem categoria).",
      ),
      note(
        "Depois de sincronizar",
        "Em <b>Eventos</b>, escolha o que aparece no app. Embaixo do botão fica o resumo da última sincronização.",
      ),
    ],
  },
  "/configuracoes": {
    version: 1,
    steps: [
      opening(
        "Configurações",
        "Regras padrão, contatos e textos fixos que o app do visitante usa.",
      ),
      note(
        "O que dá para ajustar",
        "<b>Promoções</b>: o prazo sugerido para usar o cupom. <b>Vagas</b>: os dias no ar. <b>Clube ARP</b>: a validade dos pontos e o aviso antes de vencer. Mais <b>Contato e suporte</b>, os <b>Textos fixos do app</b> e os <b>Documentos legais</b>.",
      ),
      saving(),
    ],
  },
  "/minha-conta": {
    version: 1,
    steps: [
      opening(
        "Minha conta",
        "Seus dados de acesso ao painel. Para trocar a senha, informe a atual e escolha uma nova.",
      ),
      {
        target: "avisos",
        title: "Tema e pendências",
        text: "Alterne entre claro e escuro. O sino junta o que espera por você.",
      },
    ],
  },
};
