# ERP do App ARP

Painel de gestão do **app do visitante ARP**: lojas e mapa por andar, agenda,
cupons com estoque e prazo, desafios mensais com selos por QR Code,
destaques patrocinados, notificações push e visitantes. A mesma API atende o
painel (`/api/v1/*`) e o app mobile (`/api/v1/app/*`).

| | |
|---|---|
| API | Node 22 · Fastify 5 · TypeScript · Clean Architecture · SQL puro (`pg`) |
| Web | React 19 · Vite · Tailwind CSS 4 · TanStack Query · React Hook Form |
| Dados | PostgreSQL 17 no Docker da VPS (volume `pgdata`). Imagens e arquivos no disco da VPS (volume `uploads`). Sem ORM |
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
migrations          Migrations em SQL puro (<AAAAMMDDHHMMSS>_<nome>.sql)
```

## Rodar em desenvolvimento

```bash
npm install
cp apps/api/.env.example apps/api/.env   # preencha JWT_ACCESS_SECRET e SEED_ADMIN_PASSWORD

docker compose up -d db                  # Postgres na porta 5433 (POSTGRES_PASSWORD no .env da raiz)
npm run db:migrate                       # aplica migrations/
npm run db:seed                          # cargos, admin e dados de demonstração

npm run dev:api                          # http://localhost:3000  (docs em /docs)
npm run dev:web                          # http://localhost:5173  (proxy de /api)
```

Entre com `admin@arp.com.br` e a senha de `SEED_ADMIN_PASSWORD`.

## Rodar com Docker

```bash
cp .env.example .env                     # POSTGRES_PASSWORD, JWT, STORAGE_PUBLIC_BASE_URL
docker compose up -d --build
```

- Painel: <http://localhost:8082> (nginx :80, faz proxy de `/api`)
- API: <http://localhost:3002> (node :3000)

O banco é o serviço `db` do compose (dados no volume `pgdata`). A API monta a
`DATABASE_URL` com a `POSTGRES_PASSWORD`.

**Backup**: o serviço `backup` roda `pg_dump` na subida e todo dia às 03:00 em
`/var/backups/arp-controlapp/` (pasta da VPS, fora dos volumes; outra com
`BACKUP_DIR`). Um arquivo por dia da semana (`arp-1-Mon.dump` … `arp-7-Sun.dump`),
sobrescrito na semana seguinte: no máximo 7. Não cobre perda da VPS inteira.

```bash
ls -lh /var/backups/arp-controlapp/                # backups e datas
docker compose logs backup                         # último resultado
# Restaurar (substitui o banco atual; pare a API antes):
docker compose stop api
docker compose exec -T db pg_restore -U postgres -d postgres --clean --if-exists --no-owner   < /var/backups/arp-controlapp/arp-1-Mon.dump
docker compose start api
```

## Qualidade

```bash
npm run check   # Biome + TypeScript em todos os workspaces
npm run build
```

Banco: mudança só por **nova** migration em `migrations/` (nunca editar
uma aplicada). Contrato: toda rota nova entra primeiro em
`packages/contracts/src/routes.ts`, com os schemas dela.
