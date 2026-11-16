# ERP do App ARP — API

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
| Contratos | `src/contracts`: schemas Zod, permissões e rotas. **Cópia idêntica** em `apps/web/src/contracts`: mudou um, copie para o outro |

Documentação: [arquitetura](docs/arquitetura.md) · [modelo de dados](docs/modelo-de-dados.md) ·
[escalabilidade](docs/escalabilidade.md) ·
[painel web](../web/README.md).

## Estrutura

Cada app (`apps/api`, `apps/web`) é independente: `package.json`, lockfile,
`node_modules`, `.env`, Biome, tsconfig e docker compose próprios. Nada na raiz.

```
src/modules      Domínios (modules/<domínio>/{domain,application,infra,http})
src/contracts    Contrato HTTP (o import é `@arp/contracts`, alias no tsconfig)
migrations       Migrations em SQL puro (<AAAAMMDDHHMMSS>_<nome>.sql)
ops              pg-backup.sh (serviço backup do compose)
docs             Arquitetura, modelo de dados, escalabilidade
```

## Rodar em desenvolvimento (nesta pasta)

```bash
npm install
cp .env.example .env         # preencha JWT_ACCESS_SECRET e SEED_ADMIN_PASSWORD

docker compose up -d db      # Postgres em 127.0.0.1:5433 (POSTGRES_PASSWORD do .env)
npm run db:migrate           # aplica migrations/
npm run db:seed              # cargos, admin e dados de demonstração
npm run dev                  # http://localhost:3000  (docs em /docs)
```

O painel roda à parte em `apps/web` (`npm run dev`, http://localhost:5173).

Entre com `admin@arp.com.br` e a senha de `SEED_ADMIN_PASSWORD`.

## Rodar com Docker (produção na VPS: `/var/www/controlapp-arp`)

```bash
cd apps/api && docker compose up -d --build    # api + db + backup (.env desta pasta)
cd ../web  && docker compose up -d --build     # painel; entra na rede arp-controlapp_default
```

- API: <http://localhost:3002> (node :3000)
- Painel: <http://localhost:8082> (nginx :80, faz proxy de `/api` e `/uploads` para `api:3000`)

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
npm run check   # Biome + TypeScript (rodar também em apps/web)
npm run build
```

Banco: mudança só por **nova** migration em `migrations/` (nunca editar
uma aplicada). Contrato: toda rota nova entra primeiro em
`src/contracts/routes.ts`, com os schemas dela, e o arquivo é copiado igual
para `apps/web/src/contracts/`.
