import { z } from "zod";

/**
 * Catálogo de permissões do painel. A chave é estável (vai para o banco e
 * para o JWT); rótulos e grupos são só apresentação.
 */
export const PERMISSION_CATALOG = [
  {
    group: "Gestão",
    items: [{ key: "dashboard.view", label: "Ver dashboard", description: "Indicadores do app." }],
  },
  {
    group: "Lojas e mapa",
    items: [
      { key: "stores.view", label: "Ver lojas", description: "Guia de lojas e alimentação." },
      {
        key: "stores.manage",
        label: "Gerenciar lojas",
        description: "Criar, editar e desativar lojas, horários e categorias.",
      },
      { key: "map.view", label: "Ver mapa", description: "Andares, blocos e pontos do mapa." },
      {
        key: "map.manage",
        label: "Gerenciar mapa",
        description: "Editar andares, blocos, desenho e pontos de referência.",
      },
    ],
  },
  {
    group: "Cupons",
    items: [
      { key: "coupons.view", label: "Ver cupons", description: "Promoções e cupons pegos." },
      {
        key: "coupons.manage",
        label: "Gerenciar cupons",
        description: "Criar, pausar e encerrar promoções.",
      },
      {
        key: "coupons.redeem",
        label: "Validar cupons",
        description: "Validar o código do visitante no caixa.",
      },
    ],
  },
  {
    group: "Selos",
    items: [
      {
        key: "challenges.view",
        label: "Ver desafios",
        description: "Campanhas, desafios e selos.",
      },
      {
        key: "challenges.manage",
        label: "Gerenciar desafios",
        description: "Campanhas, selos, faixas de benefício e QR Codes.",
      },
    ],
  },
  {
    group: "Agenda",
    items: [
      { key: "events.view", label: "Ver eventos", description: "Agenda de eventos." },
      {
        key: "events.manage",
        label: "Gerenciar eventos",
        description: "Criar e publicar eventos.",
      },
    ],
  },
  {
    group: "Comunicação",
    items: [
      { key: "highlights.view", label: "Ver destaques", description: "Carrossel da home do app." },
      {
        key: "highlights.manage",
        label: "Gerenciar destaques",
        description: "Destaques e mídia patrocinada.",
      },
      { key: "notifications.view", label: "Ver notificações", description: "Envios de push." },
      {
        key: "notifications.manage",
        label: "Gerenciar notificações",
        description: "Criar e agendar notificações push.",
      },
    ],
  },
  {
    group: "Conteúdo",
    items: [
      {
        key: "content.view",
        label: "Ver conteúdo",
        description: "Textos, Circuito Cultural e Sustentarp.",
      },
      {
        key: "content.manage",
        label: "Editar conteúdo",
        description: "História, regras, regulamento, Circuito Cultural e Sustentarp.",
      },
      { key: "jobs.view", label: "Ver vagas", description: "Vagas de emprego das lojas." },
      {
        key: "jobs.manage",
        label: "Gerenciar vagas",
        description: "Publicar e tirar vagas do ar (o lojista, só as da loja dele).",
      },
    ],
  },
  {
    group: "Visitantes",
    items: [
      { key: "visitors.view", label: "Ver visitantes", description: "Contas do app e histórico." },
      {
        key: "visitors.manage",
        label: "Gerenciar visitantes",
        description: "Bloquear e desbloquear contas.",
      },
    ],
  },
  {
    group: "Administração",
    items: [
      { key: "users.view", label: "Ver usuários", description: "Equipe com acesso ao painel." },
      {
        key: "users.manage",
        label: "Gerenciar usuários",
        description: "Usuários, cargos e permissões.",
      },
      { key: "audit.view", label: "Ver histórico", description: "Registro de alterações." },
      {
        key: "settings.manage",
        label: "Configurações do app",
        description: "Textos, regras padrão e contatos.",
      },
    ],
  },
] as const;

type Catalog = typeof PERMISSION_CATALOG;
export type Permission = Catalog[number]["items"][number]["key"];

export const PERMISSIONS = PERMISSION_CATALOG.flatMap((g) => g.items.map((i) => i.key)) as [
  Permission,
  ...Permission[],
];

export const permissionSchema = z.enum(PERMISSIONS);

export const permissionCatalogSchema = z.object({
  data: z.array(
    z.object({
      group: z.string(),
      items: z.array(
        z.object({ key: permissionSchema, label: z.string(), description: z.string() }),
      ),
    }),
  ),
});
export type PermissionCatalog = z.infer<typeof permissionCatalogSchema>;
