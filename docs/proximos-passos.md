# Onde paramos (01/11/2026)

## Pronto e verificado

| Parte | Estado | Verificação |
|---|---|---|
| Contratos (`packages/contracts`) | Painel + app (`App.*`), PATCH via `patchOf`, URLs só http(s) | tsc, biome |
| Banco (`supabase/migrations`, `apps/api/src/shared/infra/database`) | 12 migrations SQL, `Database`/`sql`, Storage Supabase/local, seed idempotente | testes de integração, EXPLAIN nas consultas quentes, migrations em PostgreSQL 17 |
| API (`apps/api`) | Rotas do painel + app, auth JWT + refresh rotativo, RBAC, escopo de loja, auditoria, jobs | 269 testes (+1 só com Postgres real, passou contra PG17); suíte removida em 01/11 |
| Web (`apps/web`) | Todas as telas, design do copiloto-arp | tsc, biome, build, smoke de integração (55 passos; script removido em 01/11) |
| Performance web | Carga inicial JS 216 → 174 kB gzip, prefetch, cache do Query | build |
| Escalabilidade | Rodadas de carga antes/depois em `docs/escalabilidade.md`; bench reproduzível em `apps/api/scripts/bench/` | autocannon + EXPLAIN |
| Docker | Dockerfiles, nginx (keepalive, réplicas), compose com limites | executado em 01/11: healthchecks, login/refresh/upload via :8082, smoke 55/55 |

## Próximos passos

1. **Supabase real**: preencher `DATABASE_URL` (pooler em modo session, porta 5432),
   `STORAGE_PUBLIC_BASE_URL` (imagens no volume da VPS); rodar migrations e seed.
2. **Verificação final no navegador** (dark mode, responsivo, arrastar no mapa e nos
   destaques, impressão dos QR Codes).
3. **Escalabilidade**: itens restantes em "Pendente" de `docs/escalabilidade.md`
   (contagem das listas grandes via cursor, rollup do dashboard, índice do resumo
   do mês, colunas legadas, estoque materializado, push paginado).

## Como retomar em dev

```bash
docker compose --profile local up -d db   # Postgres na 5433
npm run dev:api                 # http://localhost:3000  (docs em /docs)
npm run dev:web                 # http://localhost:5173
```

## Com Docker

```bash
docker compose --profile local up -d --build   # .env na raiz (já existe, ignorado pelo git)
docker compose --profile local stop            # mantém os volumes
```

Painel em `http://localhost:8082`, API em `http://localhost:3002`.

Login: `admin@arp.com.br` / `Admin12345` (seed local). Lojista: `casabrava@arp.com.br`.
