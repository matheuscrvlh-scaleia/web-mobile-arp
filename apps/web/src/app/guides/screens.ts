import {
  actions,
  cards,
  create,
  filters,
  menuSection,
  note,
  opening,
  preview,
  quickSearch,
  row,
  rowMenu,
  saving,
  search,
  section,
  table,
  tabs,
} from "./common";
import type { Guide } from "./types";

/*
 * Um guia por tela, pela rota (as de PATHS), ensinando os fluxos da tela:
 * como abrir, criar, publicar, tirar do app. `:id` vale o id de um registro e
 * a query na chave é obrigatória: as telas com abas têm um guia por aba
 * (`/clube?aba=trocas`), e a aba padrão fica com a chave sem query. Passo
 * cujo ponto não está na tela (sem permissão, lista vazia, lojista) é pulado
 * na hora de abrir; passo sem ponto aparece no centro.
 */
export const GUIDES: Record<string, Guide> = {
  /* Início ---------------------------------------------------------------- */
  "/dashboard": {
    version: 2,
    steps: [
      opening(
        "Boas-vindas ao painel da ARP",
        "Aqui você cuida do app do visitante: lojas, promoções, selos, clube, avisos e conteúdo. Este guia mostra onde fica cada coisa; toda tela tem o seu, no botão <b>Guia</b>.",
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
        title: "1. Comece pelas pendências",
        text: "O que precisa de você agora (cupons para aprovar, cadastros de lojista…). Clique num item para ir direto à tela que resolve. Sem nada esperando, aparece <b>Tudo em dia</b>.",
      },
      filters(
        "Escolha o período (7, 30 ou 90 dias) e, se quiser, uma loja. Todos os números e gráficos abaixo recalculam na hora.",
      ),
      cards(
        "Cadastros, cupons pegos e usados, taxa de uso, economia, selos, promoções ativas e próximos eventos. A seta compara com o período anterior. <b>Clique num cartão</b>: abre <b>De onde vem este número</b>, com as linhas que formam o total e o atalho para a tela da lista.",
      ),
      note(
        "Gráficos e rankings",
        "Mais abaixo: o movimento por dia, a hora em que os cupons são usados no caixa, o resultado das leituras de QR Code (selo dado, já tinha, vencido, inválido) e os rankings de lojas, cupons e desafios.",
      ),
    ],
  },

  /* Balcão ---------------------------------------------------------------- */
  "/cupons/validar": {
    version: 2,
    steps: [
      opening(
        "Validar cupom",
        "O visitante mostra o cupom no app (código ARP-XXXXXX e QR). Aqui você confere as condições e dá baixa no caixa. Deixe esta tela aberta no balcão.",
      ),
      {
        target: "codigo",
        title: "1. Leia ou digite o código",
        text: "O <b>ARP-</b> já vem escrito: digite as 6 letras e números (ou cole) e aperte Enter ou <b>Consultar</b>. Com câmera, <b>Ler QR</b> abre a câmera e preenche sozinho.",
      },
      {
        target: "resultado",
        title: "2. Confira e valide",
        text: "Aqui aparece o cupom: promoção, loja e as <b>condições</b> (dias em que vale, regras). Confira com o visitante e valide. Deu certo: <b>Cupom validado!</b>, e o código não vale de novo. Depois, <b>Outro código</b>.",
      },
      note(
        "Quando o caixa recusa",
        "O painel diz o motivo: <b>já foi usado</b>, <b>o prazo acabou</b> (o cupom voltou para a promoção), <b>cancelado</b>, <b>de outra loja</b>, <b>hoje não vale</b> (fora dos dias marcados) ou <b>código não encontrado</b> (confira as letras com o visitante).",
      ),
      {
        target: "recentes",
        title: "Validados agora",
        text: "Os cupons que você validou nesta aba, desde que abriu: bom para conferir no fim do turno.",
      },
      actions(
        "<b>Cupons pegos</b> abre a lista de todos os cupons: quem pegou, quando e se já usou.",
      ),
    ],
  },
  "/clube/trocar": {
    version: 2,
    steps: [
      opening(
        "Trocar pontos",
        "O visitante troca os pontos dos selos por um prêmio da lojinha, aqui no balcão do Centro de Informações. São três passos, e o prêmio sai entregue na hora.",
      ),
      search(
        "<b>1. Visitante</b>: busque pelo nome, e-mail ou telefone que ele usa no app (2 letras ou mais) e clique na pessoa. Confira o saldo de pontos. Visitante bloqueado não troca.",
      ),
      note(
        "2. Prêmio",
        "Aparecem os prêmios da lojinha. Só dá para escolher o que tem no estoque e que o saldo cobre. Errou a pessoa? <b>Escolher outro visitante</b>.",
      ),
      note(
        "3. Confirmar",
        "Confira prêmio e pontos e clique em <b>Trocar e entregar</b>: os pontos saem do saldo, o estoque baixa e você entrega o prêmio. Depois, <b>Próximo visitante</b>.",
      ),
      note(
        "Errou a troca?",
        "Logo depois, <b>Desfazer troca</b>. Mais tarde, em Clube ARP › Trocas: os pontos voltam para o visitante e o prêmio volta ao estoque (recolha o prêmio no balcão).",
      ),
      actions("<b>Ver trocas</b> abre todas as trocas já feitas."),
    ],
  },

  /* Lojas ----------------------------------------------------------------- */
  "/lojas": {
    version: 2,
    steps: [
      opening(
        "Lojas",
        "O guia de lojas e alimentação do app. Cada loja tem dados, horários, lugar no mapa, equipe e desempenho.",
      ),
      menuSection(
        "Nesta seção ficam também o Mapa, as Categorias e blocos e os Lojistas (o acesso das lojas ao painel).",
      ),
      actions(
        "<b>Nova loja</b> abre o cadastro. Troque entre <b>Cartões</b> e <b>Tabela</b>: na tabela dá para marcar várias lojas.",
      ),
      filters(
        "Busque por nome, categoria ou descrição e recorte por tipo, categoria, andar, bloco e situação. Para completar cadastros, use <b>Cadastro</b>: acha as lojas sem horário, sem foto, sem logo ou fora do mapa.",
      ),
      row(
        "Abrir uma loja",
        "Clique na loja para abrir a página dela, com as abas Dados, Horários, Localização, Equipe e Desempenho.",
      ),
      rowMenu(
        "<b>Abrir loja</b>, <b>Ver no mapa</b> e <b>Desativar</b> (a loja sai do guia, do mapa e da busca do app; dá para reativar). Errou? Use o <b>Desfazer</b> do aviso.",
      ),
      note(
        "Mudar várias de uma vez",
        "Na <b>Tabela</b>, marque as lojas: aparece a barra para mudar a <b>categoria</b>, o <b>bloco</b> ou o <b>andar</b> de todas, ou <b>Desativar</b>. Cada mudança tem Desfazer.",
      ),
    ],
  },
  "/lojas/nova": {
    version: 2,
    steps: [
      opening(
        "Nova loja",
        "Preencha os dados e crie. A loja abre na aba de horários para você continuar o cadastro.",
      ),
      section(
        "identificacao",
        "Identificação",
        "Nome e categoria principal, como aparecem na busca e no guia. <b>Já aparece no app</b> desligado deixa a loja cadastrada mas fora do app até você ativar.",
      ),
      section(
        "onde-fica",
        "Onde fica",
        "O bloco e o andar. O ponto exato no mapa vem depois, na aba Localização.",
      ),
      section(
        "visual",
        "Visual",
        "Ícone e cor da marca (vão no pino do mapa e nos cartões sem foto), foto de capa e logo.",
      ),
      section(
        "contato",
        "Contato",
        "Telefone, WhatsApp, Instagram e site viram botões na página da loja no app.",
      ),
      note(
        "Depois de criar",
        "1. <b>Horários</b>: o app mostra “aberta agora” por eles. 2. <b>Localização</b>: o pino no mapa. 3. <b>Equipe</b>: convide o lojista para ele validar cupons e cadastrar promoções.",
      ),
    ],
  },
  "/lojas/:id": {
    version: 2,
    steps: [
      opening(
        "Página da loja",
        "Tudo de uma loja numa tela só. Para o lojista, é a <b>Minha loja</b>: o que aparece no guia do app.",
      ),
      {
        target: "acoes",
        title: "Ações da loja",
        text: "<b>Ver no mapa</b>, <b>Desativar</b> (sai do guia, do mapa e da busca do app) ou <b>Reativar</b>. No <b>Mais</b>, excluir a loja.",
      },
      {
        target: "pendencias-loja",
        title: "Falta no cadastro",
        text: "O que ainda falta para a loja ficar completa no app, com o atalho para resolver (ex.: <b>Cadastrar horário</b>, <b>Pôr no mapa</b>).",
      },
      tabs(
        "<b>Dados</b>: o cadastro. <b>Horários</b>: quando abre. <b>Localização</b>: o pino no mapa. <b>Equipe</b>: quem da loja acessa o painel. <b>Desempenho</b>: os cupons da loja. Cada aba tem o seu guia.",
      ),
      section(
        "identificacao",
        "Identificação",
        "Nome, categoria principal (e outras, se a loja vende mais de uma coisa) e se <b>já aparece no app</b>.",
      ),
      section(
        "onde-fica",
        "Onde fica",
        "Bloco e andar. Trocar o andar tira a loja do mapa: ponha de novo na aba Localização.",
      ),
      section("visual", "Visual", "Ícone, cor da marca, foto de capa e logo."),
      section("contato", "Contato", "Viram botões na página da loja no app."),
      saving(
        "Mudou algo? A barra <b>Alterações não salvas</b> aparece embaixo: <b>Salvar dados</b> ou <b>Desfazer</b>.",
      ),
    ],
  },
  "/lojas/:id?aba=dados": {
    version: 1,
    steps: [
      opening("Dados da loja", "O cadastro da loja como aparece no guia do app."),
      section("identificacao", "Identificação", "Nome, categoria e se <b>já aparece no app</b>."),
      section("onde-fica", "Onde fica", "Bloco e andar. Trocar o andar tira a loja do mapa."),
      section("visual", "Visual", "Ícone, cor, foto de capa e logo."),
      saving("Mudou algo? <b>Salvar dados</b> na barra de baixo."),
    ],
  },
  "/lojas/:id?aba=horarios": {
    version: 1,
    steps: [
      opening(
        "Horários da loja",
        "O app mostra “aberta agora” ou “fechada agora” por estes horários, no fuso de Brasília. Loja sem horário fica com o aviso <b>Sem horário</b>.",
      ),
      note(
        "Como preencher",
        "Para cada dia, abre às e fecha às. Restaurante que fecha à tarde: <b>+ intervalo</b> para o segundo horário. Fecha depois da meia-noite: o painel avisa <b>Fecha no dia seguinte</b>.",
      ),
      {
        target: "copiar-horarios",
        title: "Copiar para todos",
        text: "Preencheu a segunda-feira? Copie para os outros dias e só ajuste o que muda (ex.: domingo).",
      },
      saving("Termine com <b>Salvar horários</b>."),
    ],
  },
  "/lojas/:id?aba=localizacao": {
    version: 1,
    steps: [
      opening(
        "Localização no mapa",
        "O pino da loja no mapa do andar dela. O andar e o bloco se mudam na aba Dados.",
      ),
      note(
        "Pôr ou mover o pino",
        "Clique no lugar certo do mapa ou arraste o pino: a posição salva sozinha, com <b>Desfazer</b> no aviso. Em <b>Ajuste fino</b>, os números de horizontal e vertical.",
      ),
      note(
        "Tirar do mapa e editor",
        "<b>Tirar do mapa</b> some com o pino do app (a loja continua no guia). <b>Abrir editor do mapa</b> leva ao Mapa, onde ficam todas as lojas do andar.",
      ),
    ],
  },
  "/lojas/:id?aba=equipe": {
    version: 1,
    steps: [
      opening(
        "Equipe da loja",
        "Quem entra no painel por esta loja: valida cupons no balcão, cadastra promoções e vagas. Cada pessoa só vê o que é da própria loja.",
      ),
      {
        target: "link-convite",
        title: "1. Convide o lojista",
        text: "Gere o link de convite e mande para a loja (copiar, WhatsApp ou e-mail). Vale 7 dias e serve para mais de uma pessoa da loja. Em <b>Links ativos</b>, cancele um link mandado errado.",
      },
      note(
        "2. Aprove o cadastro",
        "Quem se cadastra pelo link aparece aqui como <b>Esperando aprovação</b>. <b>Aprovar</b> libera o acesso e avisa por e-mail; <b>Recusar</b> obriga a pessoa a se cadastrar de novo.",
      ),
      note(
        "Tirar o acesso",
        "<b>Remover acesso</b> tira a pessoa do painel na hora (a sessão cai). Cupons, vagas e histórico continuam. <b>Devolver acesso</b> desfaz.",
      ),
    ],
  },
  "/lojas/:id?aba=desempenho": {
    version: 1,
    steps: [
      opening(
        "Desempenho da loja",
        "Como os cupons da loja estão indo no app, no período escolhido (7, 30 ou 90 dias).",
      ),
      note(
        "O que olhar",
        "<b>Cupons no período</b>: usados, aguardando uso e os que voltaram. Os <b>quadrados</b> mostram cada cupom liberado. <b>Usos por hora</b>: quando os clientes validam no caixa. <b>Últimos usos</b>: os códigos validados.",
      ),
    ],
  },
  "/mapa": {
    version: 2,
    steps: [
      opening(
        "Mapa",
        "O mapa por andar do app: o desenho do andar, os pinos das lojas e os pontos de referência (reciclagem, início do tour, estacionamento…).",
      ),
      {
        target: "andares",
        title: "Escolha o andar",
        text: "Troque de andar aqui. Se houver desenho sem salvar, o painel pergunta antes.",
      },
      tabs(
        "<b>Lojas e pontos</b>: onde fica cada loja e os pontos de referência. <b>Desenho</b>: as formas do andar (blocos, praça, estacionamento).",
      ),
      {
        target: "mapa",
        title: "O andar",
        text: "Arraste um pino para mudar o lugar da loja ou do ponto; salva sozinho, com <b>Desfazer</b> no aviso. Clique num pino para abrir os detalhes ao lado.",
      },
      {
        target: "sem-lugar",
        title: "Lojas sem lugar no mapa",
        text: "As lojas do andar que ainda não aparecem no mapa do app. Clique em <b>Pôr no mapa</b> e depois no lugar certo do mapa: salva sozinho.",
      },
      note(
        "Pino selecionado",
        "Com uma loja selecionada: <b>Abrir loja</b>, <b>Tirar do mapa</b> ou trocar de andar (a loja sai deste mapa e você posiciona no outro). Pontos de referência: crie com o ícone, renomeie ou exclua.",
      ),
      {
        target: "planta",
        title: "Desenho: comece pela planta",
        text: "Envie a planta do andar (foto ou imagem do PDF) para desenhar por cima. Ela só aparece aqui no painel; o app mostra o desenho.",
      },
      note(
        "Desenho: formas",
        "Em <b>Adicionar forma</b>, escolha o tipo (ex.: bloco) e arraste no mapa; a alça do canto muda o tamanho. A lista de formas tem <b>Para frente</b>, <b>Para trás</b> e <b>Remover</b>.",
      ),
      {
        target: "salvar-desenho",
        title: "Salvar desenho",
        text: "O desenho só vai para o app quando você salva. <b>Desfazer</b> volta ao último salvo.",
      },
      create(
        "Novo andar",
        "Cada andar tem nome, sigla do botão do elevador (T, 1, S1) e nível (0 = 1º andar).",
      ),
    ],
  },
  "/categorias": {
    version: 2,
    steps: [
      opening("Categorias de loja", "As categorias organizam o guia de lojas e os filtros do app."),
      tabs("<b>Categorias de loja</b> e <b>Blocos</b> (os prédios da ARP)."),
      create(
        "Nova categoria",
        "Nome (ex.: Restaurantes, Moda, Pet) e ícone. Cada tipo de loja (as abas logo abaixo) tem as suas categorias.",
      ),
      row(
        "A ordem é a do app",
        "Arraste pela alça ou use as setas para subir e descer: salva na hora e o app já mostra assim (com <b>Desfazer</b>). O número de lojas abre a lista delas.",
      ),
      rowMenu(
        "<b>Editar</b> ou <b>Excluir</b>. Ao excluir uma categoria com lojas, o painel pede para onde <b>mover as lojas</b>.",
      ),
    ],
  },
  "/categorias?aba=blocos": {
    version: 1,
    steps: [
      opening(
        "Blocos",
        "Os prédios da ARP (ex.: Bloco 80), usados no “onde fica” de cada loja e no desenho do mapa.",
      ),
      create("Novo bloco", "Dê o nome do bloco como aparece para o visitante."),
      row("Ordem", "Arraste ou use as setas: a ordem vale para os filtros do app."),
      rowMenu("<b>Editar</b> ou <b>Excluir</b>. Bloco com lojas pede para onde mover as lojas."),
    ],
  },
  "/lojistas": {
    version: 2,
    steps: [
      opening(
        "Lojistas",
        "O acesso das lojas ao painel. O lojista se cadastra por um link e só entra depois que a ARP aprova; o aviso vai por e-mail. A equipe de cada loja também aparece na página da loja, aba Equipe.",
      ),
      {
        target: "link-convite",
        title: "1. Gere o link de cadastro",
        text: "Escolha a loja e clique em <b>Gerar link</b>. Mande por <b>Copiar link</b>, <b>Enviar por WhatsApp</b> ou <b>Enviar por e-mail</b>. Vale 7 dias e serve para mais de uma pessoa da mesma loja. A loja já tem link? Gerar outro cancela o anterior.",
      },
      note(
        "2. O lojista se cadastra",
        "Pelo link, ele preenche nome, e-mail, WhatsApp e senha e vê <b>Cadastro enviado</b>. Ainda não entra: espera a sua aprovação.",
      ),
      {
        target: "aprovar",
        title: "3. Aprove",
        text: "Em <b>Cadastros</b>, confira a loja e o e-mail e clique em <b>Aprovar</b> (ele recebe o aviso por e-mail e já pode entrar) ou <b>Recusar</b>.",
      },
      table(
        "Filtre pela situação: Aguardando, Aprovado ou Recusado. De quem já entrou, <b>Remover acesso</b> tira do painel na hora; <b>Devolver acesso</b> desfaz.",
      ),
      note(
        "Links ativos",
        "Os links que ainda abrem o cadastro. Mandou para a pessoa errada? <b>Cancelar link</b>: ele para de abrir na hora.",
      ),
    ],
  },

  /* Promoções ------------------------------------------------------------- */
  "/cupons": {
    version: 2,
    steps: [
      opening(
        "Promoções",
        "Os cupons das lojas no app. O caminho: a promoção é <b>publicada</b> → o visitante <b>pega</b> o cupom e recebe um código único (ARP-XXXXXX) → mostra no caixa → a loja <b>valida</b>. Não usou no prazo? O cupom volta para outra pessoa.",
      ),
      menuSection(
        "Nesta seção ficam também os cupons pegos pelos visitantes e, para a equipe da ARP, os cupons que esperam aprovação.",
      ),
      actions(
        "<b>Nova promoção</b> abre o cadastro. Troque entre <b>Cartões</b> e <b>Tabela</b>: na tabela dá para marcar várias.",
      ),
      filters(
        "Busque pelo nome e recorte por tipo de loja, loja, situação (rascunho, agendada, pausada, esgotada, encerrada, arquivada) e revisão da ARP. Em <b>Ordenar</b>: as que terminam primeiro, as mais usadas, as com menos restantes.",
      ),
      row(
        "Abrir uma promoção",
        "Clique para ver a promoção como está no app, as regras, o estoque e quem pegou o cupom.",
      ),
      rowMenu(
        "<b>Editar</b>, <b>Duplicar</b>, <b>Pausar</b>/<b>Retomar</b> (some do app e volta), <b>Encerrar</b> (acaba de vez; para repetir, duplique), <b>Arquivar</b> e <b>Excluir</b>.",
      ),
      note(
        "Várias de uma vez e revisão",
        "Na <b>Tabela</b>, marque as promoções para encerrar ou excluir de uma vez. Cupom criado ou alterado por lojista só vai ao app depois que a ARP aprova; recusado, o lojista vê o motivo.",
      ),
    ],
  },
  "/cupons?review=pending": {
    version: 2,
    steps: [
      opening(
        "Aprovar cupons",
        "Cupons criados ou alterados por lojistas, esperando a ARP conferir. Aprovado, vai ao app quando estiver publicado; recusado, o lojista vê o motivo e pode corrigir.",
      ),
      filters("Busque pelo nome ou recorte por loja."),
      row(
        "Confira o cupom",
        "Texto, desconto, regras, estoque e período. Clique para abrir o detalhe, se precisar.",
      ),
      {
        target: "aprovar",
        title: "Aprovar ou recusar",
        text: "<b>Aprovar</b> pede confirmação e libera o cupom. <b>Recusar</b> pede o <b>motivo</b> (ex.: desconto acima do permitido), que o lojista vê para corrigir. O número no menu mostra quantos ainda esperam.",
      },
    ],
  },
  "/cupons/nova": {
    version: 2,
    steps: [
      opening(
        "Nova promoção",
        "Monte o cupom de cima para baixo, olhando a prévia. No fim, publique, agende ou salve como rascunho.",
      ),
      section(
        "lojas",
        "Lojas",
        "De quem é a promoção. Escolha <b>várias lojas</b> para criar uma promoção igual em cada uma (ex.: Black Friday).",
      ),
      section(
        "cartao",
        "Cartão",
        "O que o visitante vê na lista: o <b>Destaque</b> grande (R$ 5, 15%, Grátis, 1 + 1), o complemento, o título e a foto ou o ícone.",
      ),
      section(
        "quando-vale",
        "Quando vale",
        "Começo e fim (sem fim, vale até encerrar ou esgotar), os <b>dias da semana</b> em que vale (fora deles, o caixa recusa) e o texto de horário que o app mostra.",
      ),
      section(
        "estoque-e-prazo-para-usar",
        "Estoque e prazo",
        "Quantos cupons liberar e até quando quem pegou pode usar: <b>algumas horas depois de pegar</b>, <b>até uma data fixa</b> ou <b>até o fim da promoção</b>. Não usou no prazo? O cupom volta para outra pessoa.",
      ),
      section(
        "detalhes",
        "Detalhes",
        "As regras (o caixa vê ao validar) e a <b>economia por uso</b>, que soma no “você economizou” do visitante e nos relatórios.",
      ),
      preview(),
      note(
        "Publicar",
        "<b>Publicar</b> põe no app agora; com início no futuro, vira <b>Agendar</b>. <b>Salvar rascunho</b> guarda fora do app. Do lojista, o cupom passa pela aprovação da ARP antes de aparecer.",
      ),
    ],
  },
  "/cupons/:id": {
    version: 2,
    steps: [
      opening(
        "Promoção",
        "A promoção como está no app, as regras, o estoque e quem já pegou o cupom.",
      ),
      actions(
        "<b>Editar</b> e a ação principal do momento: <b>Pausar</b>, <b>Retomar</b> ou, se encerrada (não muda mais), <b>Duplicar como nova</b>.",
      ),
      rowMenu(
        "<b>Duplicar</b>, <b>Encerrar</b> (acaba de vez), <b>Arquivar</b> e <b>Excluir</b>. Errou? Quase tudo tem <b>Desfazer</b> no aviso.",
        "Mais",
      ),
      note(
        "Regras no app",
        "<b>Código único</b> (vale uma vez, um por pessoa), <b>Mostre no caixa</b> (a loja valida em Validar cupom) e <b>Não usou? Ele volta</b>. Se a promoção vale selo na baixa, o quadro mostra os desafios ligados.",
      ),
      table(
        "Cupons pegos desta promoção: quem pegou, quando e se já usou. <b>Ver todos com filtros</b> abre a lista completa em Cupons pegos.",
      ),
    ],
  },
  "/cupons/:id/editar": {
    version: 2,
    steps: [
      opening(
        "Editar promoção",
        "Mude o que precisar e salve. Se quem altera é o lojista, o cupom volta para a aprovação da ARP.",
      ),
      section("cartao", "Cartão", "Destaque, título e foto do cartão do app."),
      section("quando-vale", "Quando vale", "Período e dias da semana."),
      section(
        "estoque-e-prazo-para-usar",
        "Estoque e prazo",
        "Quantos cupons e até quando quem pegou pode usar.",
      ),
      preview(),
      saving(
        "A loja da promoção não muda: para outra loja, duplique. Termine com <b>Salvar alterações</b>.",
      ),
    ],
  },
  "/cupons/pegos": {
    version: 2,
    steps: [
      opening(
        "Cupons pegos",
        "Cada cupom que um visitante pegou: o código, quando pegou, se já usou no caixa e quem validou.",
      ),
      actions(
        "<b>Exportar CSV</b> baixa a lista com os filtros em uso. <b>Validar cupom</b> abre o balcão.",
      ),
      filters(
        "Busque pelo código ou visitante e recorte por loja, promoção e situação: <b>Aguardando uso</b>, usado, <b>Venceu (voltou)</b> ou cancelado.",
      ),
      {
        target: "validar",
        title: "Validar daqui",
        text: "Cupom ainda aguardando uso tem <b>Validar</b>: abre o Validar cupom já com o código preenchido.",
      },
      table(
        "Um cupom por linha: código, visitante, promoção, quando pegou, quando usou e quem validou.",
      ),
    ],
  },

  /* Selos ----------------------------------------------------------------- */
  "/campanhas": {
    version: 2,
    steps: [
      opening(
        "Campanhas",
        "As campanhas mensais de selos. O caminho: <b>1.</b> crie a campanha → <b>2.</b> cadastre os desafios (cada um dá um selo) e gere os QR Codes → <b>3.</b> monte as faixas de benefício → <b>4.</b> publique.",
      ),
      menuSection("Nesta seção ficam as Campanhas (com os desafios dentro) e a coleção de Selos."),
      actions("<b>Nova campanha</b>: ela nasce em rascunho, fora do app, até você publicar."),
      search("Procure a campanha pelo nome."),
      tabs("Filtre pela fase da campanha."),
      row(
        "Abrir uma campanha",
        "Cada cartão mostra desafios, participantes, selos dados e as faixas. Clique para abrir e continuar o passo a passo.",
      ),
      rowMenu(
        "<b>Duplicar para o próximo mês</b> (copia desafios e faixas, em rascunho), <b>Despublicar</b> (sai do app e os QR Codes param de dar selo), <b>Arquivar</b> e <b>Excluir</b>.",
      ),
    ],
  },
  "/campanhas/nova": {
    version: 2,
    steps: [
      opening(
        "Nova campanha",
        "Ela nasce em rascunho, fora do app. Depois de criar, você cai nos desafios.",
      ),
      section(
        "campanha",
        "Nome",
        "Aparece no topo da tela de Selos do app (ex.: Desafios de novembro).",
      ),
      section(
        "periodo",
        "Período",
        "Horário de Brasília. Os QR Codes só dão selo enquanto a campanha está no ar.",
      ),
      note(
        "Próximos passos",
        "Na campanha: aba <b>Desafios</b> (o que dá cada selo e os QR Codes), aba <b>Faixas de benefício</b> e, por fim, <b>Publicar</b>.",
      ),
    ],
  },
  "/campanhas/:id": {
    version: 2,
    steps: [
      opening("Resumo da campanha", "Como a campanha está indo e o que falta para publicar."),
      {
        target: "checklist",
        title: "O que falta para publicar",
        text: "Em rascunho, a lista mostra o que já está pronto e o que ainda falta antes de publicar.",
      },
      actions(
        "<b>Publicar</b> põe a campanha no app (com início no futuro, <b>Agendar publicação</b>). Publicada, <b>Despublicar</b> tira do app e os QR Codes param de dar selo.",
      ),
      rowMenu("<b>Duplicar para o próximo mês</b>, <b>Arquivar</b> e <b>Excluir</b>.", "Mais"),
      tabs(
        "<b>Resumo</b>, <b>Desafios</b> (o que dá cada selo), <b>Faixas de benefício</b> (o prêmio por juntar selos) e <b>Dados</b> (nome e período). Cada aba tem o seu guia.",
      ),
      note(
        "Neste resumo",
        "Desafios, participantes (com ao menos um selo), selos dados e <b>quem alcançou cada faixa</b>.",
      ),
    ],
  },
  "/campanhas/:id?aba=desafios": {
    version: 1,
    steps: [
      opening(
        "Desafios da campanha",
        "O que o visitante faz para ganhar cada selo: ler um QR Code (tour, descarte, evento) ou algo automático (pagar o estacionamento, dar baixa num cupom).",
      ),
      create("Novo desafio", "Cadastre o desafio; ao criar, você vai direto gerar o QR Code dele."),
      {
        target: "cartazes",
        title: "Gerar cartazes do mês",
        text: "Os cartazes A4 de todos os desafios de QR, por semana. O QR impresso vale no máximo 7 dias, para uma foto do cartaz não dar selo para sempre.",
      },
      row(
        "Ordem e abrir",
        "A ordem da lista é a do app: arraste ou use as setas. Clique no desafio para abrir os QR Codes.",
      ),
      {
        target: "ativo-no-app",
        title: "Ativo no app",
        text: "Desligue para <b>pausar</b> o desafio: some do app e os QR Codes param de dar selo. Ligue de novo para retomar.",
      },
      search("Busque o desafio pelo nome; ao lado, veja os ativos ou os pausados."),
    ],
  },
  "/campanhas/:id?aba=faixas": {
    version: 1,
    steps: [
      opening(
        "Faixas de benefício",
        "Ao juntar N selos na campanha, o visitante ganha um benefício. Sem faixas, os selos valem só pela coleção.",
      ),
      create(
        "Nova faixa",
        "Quantos selos, o benefício (ex.: 10% OFF no estacionamento) e o ícone. O app mostra o progresso até cada faixa.",
      ),
      saving("Termine com <b>Salvar faixas</b>. Quem alcançou cada faixa aparece no Resumo."),
    ],
  },
  "/campanhas/:id?aba=dados": {
    version: 1,
    steps: [
      opening("Dados da campanha", "O nome e o período."),
      section("campanha", "Nome", "Aparece no topo da tela de Selos do app."),
      section(
        "periodo",
        "Período",
        "Horário de Brasília. Os QR Codes só dão selo enquanto a campanha está no ar.",
      ),
      saving("Termine com <b>Salvar campanha</b>."),
    ],
  },
  "/desafios": {
    version: 2,
    steps: [
      opening(
        "Desafios",
        "O que o visitante faz para ganhar cada selo. Os desafios ficam dentro de uma campanha.",
      ),
      filters(
        "Escolha a campanha. <b>Abrir campanha</b> leva à campanha inteira (faixas, publicação).",
      ),
      create("Novo desafio", "Cadastre o desafio; ao criar, você vai direto gerar o QR Code dele."),
      {
        target: "cartazes",
        title: "Gerar cartazes do mês",
        text: "Os cartazes A4 de todos os desafios de QR, por semana. O QR impresso vale no máximo 7 dias.",
      },
      row(
        "Abrir um desafio",
        "Clique para abrir os QR Codes e os dados. Arraste para mudar a ordem do app.",
      ),
      {
        target: "ativo-no-app",
        title: "Ativo no app",
        text: "Desligue para pausar o desafio: some do app e os QR Codes param de dar selo.",
      },
    ],
  },
  "/desafios/novo": {
    version: 2,
    steps: [
      opening("Novo desafio", "Cada desafio dá um selo. Depois de criar, gere o QR Code."),
      section(
        "desafio",
        "Desafio",
        "A campanha, o título (ex.: Faça o tour da ARP), <b>como cumprir</b> (onde está o QR ou o que fazer) e o ícone.",
      ),
      section(
        "selo-e-validacao",
        "Selo e validação",
        "O selo que o visitante ganha e como comprova: <b>QR Code</b> (lê um QR da loja ou da ARP) ou <b>Automático</b> (quando a loja dá baixa num cupom escolhido, ou por integração, como pagar o estacionamento).",
      ),
      section(
        "loja-evento-e-periodo",
        "Loja, evento e período",
        "Quase sempre fica vazio. <b>Produto do parceiro</b>: o lojista gera o QR e os selos entram na cobrança. Período próprio: em branco, vale o da campanha.",
      ),
      saving("Ao criar, você cai na aba QR Codes para gerar o primeiro."),
    ],
  },
  "/desafios/:id": {
    version: 2,
    steps: [
      opening("QR Codes do desafio", "Os QR Codes que dão o selo e onde cada um fica."),
      actions(
        "<b>Pausar desafio</b> some com ele do app e os QR param de dar selo; <b>Retomar desafio</b> volta.",
      ),
      create(
        "1. Gerar QR Code",
        "Dê um rótulo (onde o QR fica, ex.: Totem da praça central) e escolha: <b>impresso</b> (vale no máximo 7 dias) ou <b>modo telão</b> (para TV ou tablet: o código muda sozinho, foto ou print não servem).",
      ),
      row(
        "2. Ponha o QR no lugar",
        "Impresso: <b>Imprimir</b> (cartaz A4 ou etiquetas) ou baixe o PNG. Telão: <b>Abrir telão</b> no aparelho. A etiqueta diz se está <b>Valendo</b>, <b>Vencido</b>, <b>Revogado</b> ou parado, e os números mostram as leituras.",
      ),
      note(
        "Trocar ou tirar um QR",
        "O lápis edita. <b>Revogar</b> faz o QR parar de dar selo na hora (para um cartaz fotografado, por exemplo); <b>Reativar</b> volta.",
      ),
      {
        target: "cartazes",
        title: "Cartazes do mês",
        text: "Gera de uma vez os cartazes das próximas semanas, um por folha A4.",
      },
      tabs("<b>Dados do desafio</b>: título, como cumprir, selo e validação."),
    ],
  },
  "/desafios/:id?aba=dados": {
    version: 1,
    steps: [
      opening("Dados do desafio", "O que o desafio pede e o selo que dá."),
      section("desafio", "Desafio", "Campanha, título, como cumprir e ícone."),
      section(
        "selo-e-validacao",
        "Selo e validação",
        "Trocar para <b>automático</b> desliga os QR Codes do desafio (o painel pede confirmação).",
      ),
      saving("Termine com <b>Salvar desafio</b>."),
    ],
  },
  "/selos": {
    version: 2,
    steps: [
      opening(
        "Selos",
        "A coleção de selos do app. Cada desafio dá um selo, e cada selo vale pontos no Clube ARP.",
      ),
      actions(
        "<b>Novo selo</b>: nome, ícone, cores, descrição, <b>pontos</b> no Clube, validade dos pontos e se é <b>repetível</b> (pode ser ganho de novo).",
      ),
      tabs(
        "<b>Coleção</b>: os selos como aparecem no app. <b>Conquistados</b>: quem ganhou qual selo.",
      ),
      search("Busque o selo pelo nome e veja os ativos ou os arquivados."),
      row("Um selo", "Como aparece no app, com os pontos que vale no Clube."),
      rowMenu(
        "<b>Editar</b>, <b>Arquivar</b> (fica fora da escolha de desafios novos; quem ganhou mantém) e <b>Excluir</b> (só se ninguém ganhou e nenhum desafio usa).",
      ),
    ],
  },
  "/selos?aba=conquistados": {
    version: 1,
    steps: [
      opening(
        "Selos conquistados",
        "Quem ganhou cada selo, por qual desafio e quando. O selo aparece aqui quando o visitante lê um QR Code de desafio (ou cumpre um desafio automático).",
      ),
      filters(
        "Busque pelo visitante e recorte por campanha e desafio. <b>Limpar filtros</b> volta para tudo.",
      ),
      table("Clique no visitante para abrir a conta dele."),
    ],
  },

  /* Clube ARP ------------------------------------------------------------- */
  "/clube": {
    version: 2,
    steps: [
      opening(
        "Clube ARP",
        "Selos valem pontos, que o visitante troca por prêmios no balcão do Centro de Informações. O app só mostra a lojinha e o ranking; quem troca é a equipe, em <b>Trocar pontos</b>.",
      ),
      actions("<b>Trocar pontos</b> abre o balcão de troca."),
      tabs(
        "<b>Lojinha</b>: os prêmios. <b>Trocas</b>: o que já foi trocado. <b>Ranking</b>: quem tem mais pontos.",
      ),
      {
        target: "regras",
        title: "Regras do clube",
        text: "Quanto vale cada selo e por quanto tempo os pontos valem, com o atalho para mudar em Selos ou em Configurações.",
      },
      create(
        "Novo prêmio",
        "Nome, descrição, foto, <b>pontos</b> e <b>estoque</b> (0 = sai da lojinha) e a posição. <b>Aparece na lojinha do app</b> desligado guarda o prêmio sem mostrar.",
      ),
      table(
        "<b>Já podem trocar</b> e <b>Perto (80%+)</b> mostram quantos visitantes têm pontos para cada prêmio: ajudam a decidir quanto comprar.",
      ),
      rowMenu("<b>Editar</b>, <b>Tirar da lojinha</b> / <b>Voltar à lojinha</b> e <b>Excluir</b>."),
    ],
  },
  "/clube?aba=trocas": {
    version: 1,
    steps: [
      opening(
        "Trocas",
        "As trocas feitas no Centro de Informações: quem trocou, qual prêmio, quantos pontos e quem fez.",
      ),
      actions("<b>Trocar pontos</b> abre o balcão para uma troca nova."),
      search(
        "Busque pelo visitante ou pelo comprovante e filtre pela situação (Entregue ou Desfeita).",
      ),
      {
        target: "desfazer-troca",
        title: "Desfazer uma troca",
        text: "Os pontos voltam para o visitante e o prêmio volta ao estoque. Recolha o prêmio no balcão.",
      },
    ],
  },
  "/clube?aba=ranking": {
    version: 1,
    steps: [
      opening(
        "Ranking",
        "Os 100 visitantes com mais pontos. Só entra quem aceitou participar, e só com apelido: é o mesmo ranking do app.",
      ),
      table("Posição, apelido e pontos."),
    ],
  },

  /* Comunicação ----------------------------------------------------------- */
  "/destaques": {
    version: 2,
    steps: [
      opening(
        "Destaques",
        "O carrossel do topo da home do app: destaques da ARP e mídia patrocinada. Cada slide tem período e um destino (um evento, um cupom, uma loja ou um link).",
      ),
      menuSection(
        "Comunicação reúne o que fala com o visitante: os Destaques, as Notificações push e a agenda de Eventos.",
      ),
      actions("<b>Novo destaque</b> cria um slide."),
      cards("Os slides que o visitante vê hoje, as impressões e o CTR (cliques ÷ impressões)."),
      filters(
        "Busque pelo nome e recorte pela situação. Com filtro, a ordem não muda: limpe os filtros para reordenar.",
      ),
      row(
        "A ordem do carrossel",
        "A lista é a ordem do app: arraste pela alça ou use as setas. A chave liga e desliga o slide no carrossel. Clique no slide para abrir e editar.",
      ),
      rowMenu(
        "<b>Publicar</b>, <b>Duplicar</b>, <b>Arquivar</b> (sai do carrossel) e <b>Excluir</b> (só o que nunca apareceu no app).",
      ),
      {
        target: "rascunhos",
        title: "Rascunhos",
        text: "Os slides ainda fora do app. Abra para terminar e publicar.",
      },
    ],
  },
  "/destaques/novo": {
    version: 2,
    steps: [
      opening(
        "Novo destaque",
        "Monte o slide olhando a prévia da home e publique, agende ou salve o rascunho.",
      ),
      section(
        "tipo",
        "Tipo",
        "<b>Destaque da ARP</b> ou <b>Patrocinado</b> (mídia paga, vendida pelo comercial: escolha o patrocinador).",
      ),
      section(
        "conteudo",
        "Conteúdo",
        "Título e subtítulo curtos, o texto do botão (sem texto, fica sem botão) e a imagem (sem imagem, o slide fica verde).",
      ),
      section(
        "destino",
        "Destino",
        "O que abre ao tocar no slide: um evento, um cupom, uma loja ou um link.",
      ),
      section("periodo", "Período", "Fora do período, o slide sai do carrossel sozinho."),
      preview("Como o slide aparece na home do app."),
      note(
        "Publicar",
        "<b>Publicar</b> põe no carrossel agora (início no futuro: <b>Agendar</b>). <b>Salvar rascunho</b> guarda fora do app.",
      ),
    ],
  },
  "/destaques/:id": {
    version: 2,
    steps: [
      opening("Destaque", "Como o slide está indo e os dados dele."),
      actions("<b>Pausar</b> tira do carrossel sem perder nada; <b>Retomar</b> volta."),
      rowMenu("<b>Duplicar</b>, <b>Arquivar</b> e as outras ações.", "Mais"),
      cards("Impressões, cliques e CTR (cliques ÷ impressões) deste slide."),
      section("conteudo", "Conteúdo", "Título, botão e imagem."),
      section("destino", "Destino", "O que abre ao tocar."),
      preview("Como o slide aparece na home do app."),
      saving("Mudou algo? <b>Salvar destaque</b> na barra de baixo."),
    ],
  },
  "/notificacoes": {
    version: 2,
    steps: [
      opening(
        "Notificações",
        "Push para quem tem o app. O caminho: escreva (fica em <b>rascunho</b>) → escolha o público → <b>agende</b> ou <b>envie agora</b>.",
      ),
      actions("<b>Nova notificação</b> abre o editor."),
      filters(
        "Recorte pela situação (rascunhos, agendadas, enviadas, canceladas) e busque pelo título.",
      ),
      row(
        "Abrir uma notificação",
        "Cada linha mostra o público e quantas pessoas recebem (estimativa, até o envio). <b>Atrasada</b>: passou da hora e não saiu; avise o suporte. Clique para abrir.",
      ),
      rowMenu(
        "<b>Cancelar agendamento</b>, <b>Voltar para rascunho</b>, <b>Usar como base</b> (nova a partir desta), <b>Duplicar</b> e <b>Excluir</b> (só o que nunca saiu).",
      ),
    ],
  },
  "/notificacoes/nova": {
    version: 2,
    steps: [
      opening(
        "Nova notificação",
        "Escreva, escolha quem recebe e o que abre ao tocar. Depois, agende ou envie.",
      ),
      section("mensagem", "Mensagem", "Título e texto curtos: aparecem na tela bloqueada."),
      section(
        "publico",
        "Público",
        "<b>Todos</b> com o app, quem <b>aceita ofertas</b> (use para promoções), <b>seguidores de uma loja</b> ou <b>interessados num evento</b>. O painel mostra quantas pessoas recebem.",
      ),
      section(
        "ao-tocar",
        "Ao tocar",
        "O que abre: o início do app, um evento, uma loja, um cupom, uma tela do app ou um link.",
      ),
      {
        target: "envio",
        title: "Envio",
        text: "<b>Agendar</b> para o dia e hora (dá para cancelar até lá) ou <b>Enviar agora</b>. O painel confirma antes de enviar. <b>Salvar rascunho</b> guarda sem enviar.",
      },
      preview("Como a notificação aparece no iPhone e no Android."),
    ],
  },
  "/notificacoes/:id": {
    version: 2,
    steps: [
      opening(
        "Notificação",
        "Rascunho: ajuste o texto e o público, depois agende ou envie. Agendada ou enviada: o que sai, para quem e quando.",
      ),
      section("mensagem", "Mensagem", "Título e texto."),
      section("publico", "Público", "Quem recebe e quantas pessoas."),
      {
        target: "envio",
        title: "Envio",
        text: "<b>Agendar</b> ou <b>Enviar agora</b>.",
      },
      rowMenu(
        "Agendada: <b>Cancelar agendamento</b> ou <b>Voltar para rascunho</b>. Enviada: <b>Usar como base</b> para outra.",
        "Mais",
      ),
      preview("Como a notificação aparece no celular."),
    ],
  },
  "/eventos": {
    version: 2,
    steps: [
      opening(
        "Eventos",
        "A agenda do app vem do site da ARP. O caminho: <b>1.</b> sincronize com o site → <b>2.</b> abra cada evento e confira → <b>3.</b> decida se ele aparece no app. O texto e as datas se mudam no site.",
      ),
      actions(
        "<b>Sincronizar com o site</b> abre Integrações: evento novo no site entra aqui fora do app; editado lá, muda aqui.",
      ),
      tabs(
        "<b>Lista</b>: todos os eventos. <b>Calendário</b>: o mês em grade. <b>Categorias</b>: os filtros da agenda do app.",
      ),
      filters("Busque pelo nome e recorte por categoria, situação, recorrência e datas."),
      row(
        "Abrir um evento",
        "Clique no evento para ver os detalhes: datas, local, categoria. As etiquetas dizem se é <b>Do site</b>, se está <b>Publicado</b> e se <b>vale selo</b>.",
      ),
      rowMenu(
        "<b>Mostrar no app</b> põe o evento na agenda do app; <b>Não mostrar no app</b> tira. Os dois têm <b>Desfazer</b> no aviso.",
        "Mostrar ou não no app",
      ),
    ],
  },
  "/eventos?aba=calendario": {
    version: 1,
    steps: [
      opening(
        "Calendário",
        "Os eventos do mês em grade. Eventos longos (ex.: Corredor Cultural) aparecem como faixa em todos os dias; os demais, no dia. Riscado: cancelado.",
      ),
      note(
        "Navegar",
        "Use <b>Mês anterior</b> e <b>Próximo mês</b>. Clique num evento para abrir os detalhes.",
      ),
    ],
  },
  "/eventos?aba=categorias": {
    version: 1,
    steps: [
      opening(
        "Categorias de evento",
        "Aparecem como filtro na agenda do app e dão o ícone padrão dos eventos sem foto. O site não tem categoria: a da sincronização se escolhe em Integrações.",
      ),
      table(
        "<b>Nova</b> cria uma categoria (nome, ícone, ordem). O lápis edita; excluir tira dos filtros do app.",
      ),
    ],
  },
  "/eventos/:id": {
    version: 2,
    steps: [
      opening(
        "Evento",
        "O evento como veio do site, só para leitura. Para mudar o texto ou a data, mude no site e sincronize em Integrações.",
      ),
      actions(
        "A decisão desta tela: <b>Mostrar no app</b> põe o evento na agenda do app; <b>Não mostrar no app</b> tira.",
      ),
      note(
        "Vale selo",
        "Para o evento dar selo, ligue um desafio a ele em Campanhas › Desafios (Loja, evento e período).",
      ),
    ],
  },

  /* Conteúdo -------------------------------------------------------------- */
  "/conteudo": {
    version: 2,
    steps: [
      opening(
        "Textos do app",
        "Os textos fixos que o app mostra: história da ARP, regulamento, regras do clube e outros.",
      ),
      menuSection("Conteúdo reúne os textos do app e as Vagas de emprego das lojas."),
      tabs(
        "<b>Textos</b>, <b>Circuito Cultural</b> (os pontos de arte no mapa) e <b>Sustentarp</b> (o que a reciclagem recebe). Trocar de aba com texto sem salvar pede confirmação.",
      ),
      note(
        "Editar um texto",
        "Cada cartão diz onde o texto aparece no app. Mude o título e o texto (separe os parágrafos com uma linha em branco) e, se houver, o link do PDF do botão <b>Baixar</b>. O que mudou fica marcado <b>Não salvo</b> até você salvar na barra de baixo.",
      ),
    ],
  },
  "/conteudo?aba=circuito": {
    version: 1,
    steps: [
      opening(
        "Circuito Cultural",
        "Obras, memórias, esculturas e murais da ARP, no mapa e na lista do Circuito no app.",
      ),
      note(
        "1. O mapa do Circuito",
        "O mapa do Circuito é a imagem onde os pontos ficam. Com ele enviado, cada ponto ganha a posição clicando no mapa.",
      ),
      create(
        "2. Novo ponto",
        "Número (como no mapa da ARP), nome, artista, local, foto, descrição e a <b>posição no mapa</b>. <b>Aparece no app</b> desligado esconde sem excluir.",
      ),
      filters(
        "Busque por nome, artista ou local. Em <b>Sem posição</b>, ache os pontos que faltam pôr no mapa.",
      ),
      rowMenu(
        "<b>Editar</b> (também para posicionar) ou <b>Excluir</b>. Para só esconder, desligue “Aparece no app”.",
      ),
    ],
  },
  "/conteudo?aba=sustentarp": {
    version: 1,
    steps: [
      opening("Sustentarp", "O que o visitante pode descartar no Sustentarp, como aparece no app."),
      create(
        "Novo item",
        "Nome e ícone, o que <b>aceita</b>, o que <b>não aceita</b> e <b>o que vira</b>. <b>Vale selo</b> conta para o desafio de descarte do Clube ARP.",
      ),
      row("Ordem no app", "Arraste ou use as setas: salva na hora, com Desfazer."),
      rowMenu("<b>Editar</b> ou <b>Excluir</b>. Para só esconder, desligue “Aparece no app”."),
    ],
  },
  "/vagas": {
    version: 2,
    steps: [
      opening(
        "Vagas",
        "Vagas de emprego das lojas, em “Vagas na ARP” no app, com o botão do WhatsApp. Saem do ar sozinhas no prazo (padrão: 30 dias).",
      ),
      actions(
        "<b>Publicar vaga</b>: título, loja, o WhatsApp para os candidatos, a descrição ou a imagem da vaga e os dias no ar.",
      ),
      search("Busque pela vaga ou pela loja."),
      tabs("<b>Ativas</b> (no app) e <b>Encerradas</b> (fora do app)."),
      row("Editar uma vaga", "Clique na vaga para editar. A coluna mostra quando ela sai do ar."),
      rowMenu(
        "<b>Encerrar agora</b> tira do app e manda para Encerradas (com Desfazer). Nas encerradas, <b>Republicar</b> põe no ar de novo pelo prazo padrão. <b>Excluir</b> some de vez.",
      ),
    ],
  },

  /* Pessoas --------------------------------------------------------------- */
  "/visitantes": {
    version: 2,
    steps: [
      opening("Usuários do app", "Quem usa o app: selos, cupons, economia e preferências."),
      menuSection(
        "Pessoas reúne os visitantes (quem usa o app) e os usuários do painel, com os cargos.",
      ),
      filters(
        "Busque por nome, e-mail ou celular e recorte pela situação (ativos ou bloqueados) e por quem <b>aceita ofertas</b> (o público das notificações de promoção).",
      ),
      row(
        "Abrir a conta",
        "Clique no visitante para ver selos, cupons, pontos do clube, lojas seguidas e eventos de interesse, e para bloquear se precisar.",
      ),
    ],
  },
  "/visitantes/:id": {
    version: 2,
    steps: [
      opening(
        "Visitante",
        "A conta de quem usa o app: selos, cupons pegos e usados, pontos do Clube, lojas que segue e eventos que marcou.",
      ),
      {
        target: "acoes",
        title: "Bloquear ou anonimizar",
        text: "<b>Bloquear</b> (com motivo): a pessoa não pega mais cupons nem ganha selos, e os cupons ativos dela deixam de valer. <b>Desbloquear</b> devolve. No <b>Mais</b>: <b>Ver no Histórico</b> e <b>Anonimizar dados (LGPD)</b>, quando a própria pessoa pede para apagar os dados; não tem volta.",
      },
      note(
        "Atalhos",
        "Em <b>Cupons recentes</b>, <b>Ver todos</b> abre os cupons dela. No <b>Clube ARP</b>, o saldo e o atalho <b>Trocar pontos</b>.",
      ),
    ],
  },
  "/usuarios": {
    version: 2,
    steps: [
      opening(
        "Usuários e cargos",
        "Quem acessa o painel: equipe da ARP e lojistas. O cargo define o que cada um vê e faz.",
      ),
      tabs("<b>Usuários</b> e <b>Cargos</b> são telas irmãs: troque por aqui."),
      actions("<b>Novo usuário</b> dá acesso a alguém, com uma senha provisória."),
      cards("Quantas pessoas têm acesso, quantas estão desativadas e quantos cargos existem."),
      filters("Busque por nome ou e-mail e recorte por cargo e situação."),
      row(
        "Abrir uma pessoa",
        "Clique para mudar o nome, o cargo e a loja ou para redefinir a senha. <b>Falta criar a senha</b>: a pessoa ainda não entrou com a senha provisória.",
      ),
      rowMenu(
        "<b>Desativar</b> tira o acesso na hora (o histórico fica, dá para reativar). <b>Excluir</b> some com a conta de vez.",
      ),
    ],
  },
  "/usuarios/novo": {
    version: 2,
    steps: [
      opening(
        "Novo usuário",
        "O acesso vale assim que você criar. A pessoa entra com uma senha provisória e cria a dela no primeiro acesso.",
      ),
      section("pessoa", "Pessoa", "Nome e e-mail de acesso."),
      section(
        "acesso",
        "Acesso",
        "O cargo define as telas e ações. Para lojista, escolha a loja: ele só vê e valida o que é da própria loja.",
      ),
      section(
        "senha-provisoria",
        "Senha provisória",
        "Gerada agora. Copie e passe para a pessoa por um canal seguro.",
      ),
      note(
        "Depois de criar",
        "A senha aparece mais uma vez para copiar e depois não aparece de novo. Perdeu? Gere outra na página do usuário (<b>Redefinir senha</b>).",
      ),
    ],
  },
  "/usuarios/:id": {
    version: 2,
    steps: [
      opening("Usuário", "Os dados, o cargo e a senha de quem acessa o painel."),
      actions(
        "<b>Desativar</b> tira o acesso na hora (o histórico fica; <b>Reativar</b> devolve). No <b>Mais</b>, excluir de vez.",
      ),
      section("pessoa", "Pessoa", "Nome e e-mail de acesso."),
      section("acesso", "Acesso", "Cargo e loja. Mudança de cargo vale no próximo acesso."),
      section(
        "redefinir-senha",
        "Esqueceu a senha?",
        "Defina uma provisória (em branco, o sistema gera). A senha atual para de funcionar, as sessões abertas caem e a pessoa cria uma nova no próximo acesso.",
      ),
      saving("Mudou nome ou cargo? <b>Salvar usuário</b> na barra de baixo."),
    ],
  },
  "/cargos": {
    version: 2,
    steps: [
      opening(
        "Cargos",
        "Cada cargo libera um conjunto de telas e ações. A mudança vale no próximo acesso de quem tem o cargo (até 15 min).",
      ),
      tabs("<b>Usuários</b> e <b>Cargos</b> são telas irmãs: troque por aqui."),
      actions("<b>Novo cargo</b>: dê o nome e marque as permissões."),
      row(
        "Abrir um cargo",
        "Clique para ver e mudar as permissões. <b>Cargo do sistema</b> tem todas e não pode ser editado nem excluído.",
      ),
    ],
  },
  "/cargos/novo": {
    version: 2,
    steps: [
      opening("Novo cargo", "Dê um nome e marque o que o cargo pode ver e fazer."),
      section(
        "cargo",
        "Cargo",
        "Nome e descrição, como aparecem na escolha do cargo de cada pessoa.",
      ),
      section(
        "permissoes",
        "Permissões",
        "Cada permissão diz quais telas do menu ela libera. Marcar <b>gerenciar</b> também libera o <b>ver</b> do mesmo assunto.",
      ),
      saving(),
    ],
  },
  "/cargos/:id": {
    version: 2,
    steps: [
      opening("Cargo", "O que o cargo pode ver e fazer."),
      section(
        "permissoes",
        "Permissões",
        "Cada permissão diz quais telas do menu ela libera. Marcar <b>gerenciar</b> também libera o <b>ver</b>. Vale no próximo acesso de quem tem o cargo.",
      ),
      rowMenu(
        "<b>Duplicar</b> (um cargo parecido) e <b>Excluir</b> (só quando ninguém tem o cargo). Ao lado, <b>Ver quem tem o cargo</b>.",
        "Mais",
      ),
      saving("Termine com Salvar na barra de baixo."),
    ],
  },

  /* Sistema --------------------------------------------------------------- */
  "/relatorios": {
    version: 2,
    steps: [
      opening(
        "Relatórios",
        "Qual promoção funcionou melhor, os cupons por loja e os selos dados no período.",
      ),
      menuSection(
        "Sistema reúne os Relatórios, o Histórico de alterações, as Integrações e as Configurações do app.",
      ),
      filters("Escolha o período e, se quiser, uma loja. Tudo abaixo recalcula."),
      cards(
        "Cupons pegos e usados, a taxa de uso (usados ÷ pegos) e a economia gerada (usados × economia por uso).",
      ),
      tabs(
        "<b>Cupons por promoção</b>, <b>Cupons por loja</b> e <b>Selos por loja e produto</b> (a base da cobrança dos parceiros).",
      ),
      table("Clique no título de uma coluna para ordenar (ex.: maior taxa de uso)."),
      actions("<b>Exportar CSV</b> baixa a aba aberta, no período escolhido."),
    ],
  },
  "/historico": {
    version: 2,
    steps: [
      opening(
        "Histórico",
        "Tudo o que foi alterado no painel e no app: quem fez, quando e o que mudou. Bom para responder “quem mexeu nisso?”.",
      ),
      filters(
        "Busque por nome ou ação e recorte pelo tipo de item, pela pessoa e pela ação (criou, editou, mudou a situação, excluiu). <b>Limpar filtros</b> volta para tudo.",
      ),
      row(
        "Uma alteração",
        "Cada entrada diz quem fez, quando e o que mudou, das mais novas para as mais antigas.",
      ),
    ],
  },
  "/integracoes": {
    version: 2,
    steps: [
      opening(
        "Integrações",
        "Sistemas de fora que alimentam o app. O que vem deles não se edita no painel.",
      ),
      note(
        "1. Escolha a categoria",
        "O site não tem categoria: escolha a <b>categoria dos eventos novos</b>. Os que já existem mantêm a deles.",
      ),
      note(
        "2. Sincronize",
        "<b>Sincronizar com o site</b> deixa a agenda igual à do espacoarp.com.br: evento novo lá entra aqui <b>fora do app</b>; editado lá, muda aqui; apagado lá, é apagado aqui. Embaixo fica o resumo da última sincronização.",
      ),
      note(
        "3. Escolha o que aparece",
        "<b>Ver eventos</b> e, em cada evento novo, <b>Mostrar no app</b>.",
      ),
    ],
  },
  "/configuracoes": {
    version: 2,
    steps: [
      opening(
        "Configurações",
        "Regras padrão, contatos e textos fixos que o app do visitante usa. O app usa os novos valores na próxima abertura.",
      ),
      section(
        "promocoes",
        "Promoções",
        "O prazo sugerido para usar o cupom depois de pegar (dá para mudar em cada promoção).",
      ),
      section("vagas", "Vagas", "Quantos dias uma vaga fica no ar antes de sair sozinha."),
      section(
        "clube-arp",
        "Clube ARP",
        "A validade dos pontos e quantos dias antes de vencer o visitante recebe o aviso (0 = sem aviso).",
      ),
      section(
        "contato-e-suporte",
        "Contato e suporte",
        "O WhatsApp e o e-mail dos botões de ajuda no perfil do app.",
      ),
      section(
        "textos-fixos-do-app",
        "Textos fixos do app",
        "Sobre a ARP, Estacionamento e Tour da ARP. História, regras e regulamento ficam em Conteúdo do app.",
      ),
      section(
        "documentos-legais",
        "Documentos legais",
        "Os links dos termos de uso e da política de privacidade.",
      ),
      saving("Termine com <b>Salvar configurações</b>."),
    ],
  },
  "/minha-conta": {
    version: 2,
    steps: [
      opening(
        "Minha conta",
        "Seus dados de acesso. Nome, e-mail e cargo são alterados por quem administra os usuários do painel.",
      ),
      note(
        "Trocar a senha",
        "Informe a senha atual e escolha uma nova: 8 caracteres ou mais, com uma letra e um número.",
      ),
      {
        target: "avisos",
        title: "Tema e pendências",
        text: "Alterne entre claro e escuro. O sino junta o que espera por você.",
      },
    ],
  },
};
