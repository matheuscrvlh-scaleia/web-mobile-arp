# ERP do App ARP

Painel de gestão do **app do visitante ARP**: lojas e mapa por andar, agenda,
cupons com estoque e prazo, desafios mensais com selos por QR Code,
destaques patrocinados, notificações push e visitantes. A mesma API atende o
painel (`/api/v1/*`) e o app mobile (`/api/v1/app/*`).

| | |
|---|---|
| API | Node 22 · Fastify 5 · TypeScript · Clean Architecture · SQL puro (`pg`) |
| Web | React 19 · Vite · Tailwind CSS 4 · TanStack Query · React Hook Form |
| Dados | Supabase: Postgres (dados) e Storage (imagens). Sem ORM, sem Supabase Auth |
| Auth | JWT de acesso (15 min) + refresh rotativo em cookie httpOnly · RBAC. App: e-mail/senha, Google/Apple (id_token) e nova senha por código no e-mail |
| Contratos | `packages/contracts`: schemas Zod, permissões e rotas compartilhados |

Documentação: [arquitetura](docs/arquitetura.md) · [modelo de dados](docs/modelo-de-dados.md) ·
[escalabilidade](docs/escalabilidade.md) ·
[web](apps/web/README.md).

## Estrutura

```
apps/api            API Fastify (modules/<domínio>/{domain,application,infra,http})
apps/web            Painel React (features/<feature>/{api,components,pages})
packages/contracts  Contrato HTTP compartilhado
supabase/migrations Migrations em SQL puro (formato do Supabase CLI)
```

## Rodar em desenvolvimento

```bash
npm install
cp apps/api/.env.example apps/api/.env   # preencha JWT_ACCESS_SECRET e SEED_ADMIN_PASSWORD

docker compose --profile local up -d db  # Postgres na porta 5433
npm run db:migrate                       # aplica supabase/migrations
npm run db:seed                          # cargos, admin e dados de demonstração

npm run dev:api                          # http://localhost:3000  (docs em /docs)
npm run dev:web                          # http://localhost:5173  (proxy de /api)
```

Entre com `admin@arp.com.br` e a senha de `SEED_ADMIN_PASSWORD`.

## Rodar com Docker

```bash
cp .env.example .env                     # DATABASE_URL do Supabase, JWT, Storage
docker compose up -d --build
```

- Painel: <http://localhost:8082> (nginx :80, faz proxy de `/api`)
- API: <http://localhost:3002> (node :3000)

Sem Supabase, use o perfil local: `DATABASE_URL=postgres://postgres:postgres@db:5432/postgres`,
`STORAGE_DRIVER=local` e `docker compose --profile local up -d --build`.

## Qualidade

```bash
npm run check   # Biome + TypeScript em todos os workspaces
npm run build
```

Banco: mudança só por **nova** migration em `supabase/migrations` (nunca editar
uma aplicada). Contrato: toda rota nova entra primeiro em
`packages/contracts/src/routes.ts`, com os schemas dela.
