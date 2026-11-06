import { z } from "zod";

/**
 * Catálogo de permissões do painel. A chave é estável (vai para o banco e
 * para o JWT); rótulos e grupos são só apresentação.
 */
export const PERMISSION_CATALOG = [
  {
    group: "Dashboard",
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
    group: "Promoções e cupons",
    items: [
      { key: "coupons.view", label: "Ver cupons", description: "Promoções e cupons pegos." },
      {
        key: "coupons.manage",
        label: "Gerenciar cupons",
        description: "Criar, pausar e encerrar promoções.",
      },
      {
        key: "coupons.approve",
        label: "Aprovar cupons",
        description: "Revisar e aprovar ou recusar os cupons criados pelos lojistas.",
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
        label: "Ver campanhas e selos",
        description: "Campanhas, desafios, selos e a lojinha do Clube.",
      },
      {
        key: "challenges.manage",
        label: "Gerenciar campanhas e selos",
        description: "Criar e editar campanhas, desafios e selos; revogar QR Codes.",
      },
      {
        key: "qr_codes.generate",
        label: "Gerar QR Code",
        description:
          "Gerar QR Code com prazo (e telão). O lojista só para a própria loja. Cada pessoa vê os que gerou.",
      },
    ],
  },
  {
    group: "Clube ARP",
    items: [
      {
        key: "club.manage",
        label: "Gerenciar o Clube",
        description: "Prêmios da lojinha e estoque (inclui trocar pontos no balcão).",
      },
      {
        // Separada de club.manage: o balcão troca sem poder mexer na lojinha.
        key: "club.redeem",
        label: "Trocar pontos no balcão",
        description:
          "Achar o visitante, trocar os pontos por um prêmio, entregar na hora e desfazer a troca.",
      },
    ],
  },
  {
    group: "Relatórios",
    items: [
      {
        key: "reports.view",
        label: "Ver relatórios",
        description: "Cupons usados e selos dados por loja e produto; ranking de visitantes.",
      },
    ],
  },
  {
    group: "Eventos",
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
    group: "Equipe e sistema",
    items: [
      { key: "users.view", label: "Ver usuários", description: "Equipe com acesso ao painel." },
      {
        key: "users.manage",
        label: "Gerenciar usuários",
        description: "Usuários, cargos e permissões.",
      },
      {
        key: "merchants.approve",
        label: "Aprovar lojistas",
        description: "Gerar o link de cadastro e aprovar ou recusar lojistas.",
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

/** Permissões que vêm junto com outra (quem gerencia o Clube também entrega prêmios). */
export const IMPLIED_PERMISSIONS: Partial<Record<Permission, readonly Permission[]>> = {
  "club.manage": ["club.redeem"],
};

/** A lista com as permissões implícitas acrescentadas (sem repetir). */
export function withImpliedPermissions<P extends string>(permissions: readonly P[]): P[] {
  const all = new Set<string>(permissions);
  for (const p of permissions)
    for (const extra of IMPLIED_PERMISSIONS[p as Permission] ?? []) all.add(extra);
  return [...all] as P[];
}

/** Rótulo e grupo de uma permissão (ex.: tela de acesso negado). */
export function permissionInfo(key: string): { label: string; group: string } | null {
  for (const g of PERMISSION_CATALOG) {
    const item = g.items.find((i) => i.key === key);
    if (item) return { label: item.label, group: g.group };
  }
  return null;
}

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
