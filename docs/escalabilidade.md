# Escalabilidade — API, banco e infraestrutura

Como a API aguenta muitos visitantes do app mobile e o painel ao mesmo tempo,
o que foi medido, o que mudou, como escalar e o que ainda falta.

Premissas do produto: **sem ORM**, **Supabase só como armazenamento**
(Postgres + Storage), **nenhum serviço obrigatório novo** (sem Redis). Peças
distribuídas são opcionais, atrás das portas existentes, e usam o próprio
Postgres.

---

## 1. Capacidade e gargalos conhecidos

| Caminho | Antes | Agora |
|---|---|---|
| Leituras públicas do app (home, lojas, mapa, agenda, cupons, desafios) | toda requisição ia ao banco, com joins e estoque derivado | cache compartilhado por réplica (TTL `APP_CACHE_TTL_SECONDS`, 15 s), camada pessoal pequena por cima, ETag/304, `Cache-Control: public` para anônimo, gzip/br |
| Exibição/clique de destaque | `UPDATE` na linha do destaque a cada exibição (fila no lock da linha mais lida, WAL, `updated_at` regravado) | contagem em memória e um upsert por destaque/dia a cada 5 s por réplica (`marketing.highlight_daily_metrics`) |
| Pegar cupom | 9–10 idas ao banco com o cupom travado (`FOR UPDATE`) | 3 idas com o lock (preparar, inserir, auditar) + commit |
| Listas grandes do painel (cupons pegos, auditoria, visitantes) | `count(*) over()` materializava a tabela inteira a cada página (52 MB em disco temporário com 500 mil pegos) | página pelo índice + contagem enxuta à parte; cursor (keyset) opcional sem contagem nem offset |
| Dashboard | 7 consultas em paralelo (7 conexões do pool por carregamento), KPI com `OR` entre colunas → seq scan | 1 transação só leitura `REPEATABLE READ` (um instante só, uma conexão), KPIs em varreduras de intervalo separadas |
| "Visitante ativo?" | 1 consulta por requisição autenticada do app | cache de até 15 s, invalidado pelo bloqueio no painel |
| Sessões do app | cada refresh grava uma linha, mantida até vencer (90 dias) | rotacionadas com mais de 7 dias são apagadas pelo job |

**Gargalos que continuam:**

- **Banco é o recurso escasso.** O pooler do Supabase (modo session) tem um
  limite de conexões por projeto; `réplicas × DB_POOL_MAX` não pode passar
  dele (seção 3).
- **Cupom muito disputado** é serializado por desenho (`FOR UPDATE` no
  cupom). Vazão máxima ≈ 1 / (tempo com o lock). Com o banco na mesma região
  (~1 ms por ida) isso dá centenas de pegos/s no mesmo cupom; com latência
  alta entre API e banco cai proporcionalmente — mantenha a API na região do
  Supabase.
- **Estoque derivado** (`count` dos pegos ativos + usados por cupom) custa
  proporcional às unidades ocupadas do cupom (index-only no
  `coupon_claims_stock_idx`). Para cupons com dezenas de milhares de
  unidades, considerar contador materializado (pendente).
- **Envio de push** monta o público inteiro em memória dentro da transação
  do job (100 mil tokens ≈ 6 MB). Para milhões, paginar o público (pendente).

## 2. O que foi medido

Ambiente: Windows, Node 22, PGlite (Postgres 18 em WASM, **uma sessão só**,
`DB_POOL_MAX=1`) com volume inflado: 500 mil `coupon_claims`, 500 mil
`audit_logs`, 100 mil visitantes, 100 mil favoritos, 50 mil `qr_scans`,
27 mil selos, 20 mil lojas (140 mil horários), 20 mil eventos, 2 mil cupons.
Números absolutos **não** representam produção (PGlite serializa tudo); o
que vale é a comparação e a ausência de erro sob concorrência.

### Carga (autocannon, 20 conexões, 10 s) — antes

| Rota | req/s | p50 | p99 | erros |
|---|---:|---:|---:|---|
| app home (anônimo) | 16 | 1161 ms | 1231 ms | — |
| app home (logado) | 14 | 1223 ms | 1810 ms | — |
| app lojas p1 | 39 | 497 ms | 732 ms | — |
| app cupons p1 | 17 | 1100 ms | 1403 ms | — |
| app mapa | 147 | 117 ms | 1218 ms | — |
| painel lojas p1 | 31 | 634 ms | 659 ms | — |
| painel cupons pegos p1 | 1 | 5,6 s | 9,2 s | 22 timeouts |
| painel auditoria p1 | 0 | 10 s | 10 s | 36 timeouts + 500 |
| painel auditoria p2000 | 1 | 10 s | 10 s | 24 timeouts + 500 |
| painel visitantes p1 | 2 | 9,4 s | 9,9 s | 10 timeouts |
| dashboard 30d (sem cache) | 2 | 5,9 s | 9,9 s | — |
| lookup de código | 286 | 16 ms | 18 ms | — |
| pegar cupom: 1000 visitantes × estoque 300 (50 conexões) | 333 | 100 ms | 174 ms | 300 × 201, 700 × 409 `COUPON_SOLD_OUT`, **300 no banco (estoque não estourou)** |

Os 500 no painel eram o pool esgotando o tempo de espera por conexão
(agora vira **503 com `Retry-After`**).

### EXPLAIN (ANALYZE, BUFFERS) — antes

| Consulta | Tempo | Causa |
|---|---:|---|
| painel cupons pegos p1 | 662 ms | `WindowAgg` sobre 500 mil linhas com 4 joins, 52 MB em disco temporário |
| auditoria p1 | 312 ms | `WindowAgg` sobre 500 mil linhas (20 MB em disco) |
| auditoria offset 40 000 | 70 ms | offset percorre 40 mil entradas do índice |
| visitantes p1 | 56 ms | `WindowAgg` sobre 100 mil (subconsultas já iam só nas 20 linhas) |
| app lojas p1 (20 mil lojas) | 24 ms | `WindowAgg` + hash joins de 19 mil lojas |
| home: cupons acabando | 77 ms | estoque derivado de 1 340 cupons × ~250 pegos (index-only) |
| dashboard KPIs 30d | 312 ms | seq scan em visitantes e em `coupon_claims` (o `OR claimed_at/redeemed_at`) |
| dashboard série diária 30d | 140 ms | bitmap nos índices de intervalo (ok) |
| contagem enxuta `count(*)` 500 mil | 36–58 ms | referência para a contagem separada |

### Carga (autocannon, 20 conexões, 10 s) — depois

Rodada de 01/11/2026 com os scripts versionados em `apps/api/scripts/bench/`
(seção 7), nas mesmas condições do "antes": mesma máquina (Windows, Node 22),
PGlite com `DB_POOL_MAX=1`, mesmo volume **e as mesmas distribuições** do
SQL de volume usado no "antes" (500 mil pegos — 40% usados, 40% vencidos,
10% cancelados, 10% ativos dos últimos 2 dias —, 500 mil linhas de
auditoria, 100 mil visitantes e favoritos, 50 mil leituras de QR, 27 mil
selos, 20 mil lojas com 140 mil horários e 2% com pino no mapa, 20 mil
eventos, 2 mil cupons de 1000 unidades; banco com 476 MB). API do build
(`node dist/main.js`, porta 3100), `JOBS_ENABLED=false`, `LOG_LEVEL=warn`,
`DASHBOARD_CACHE_TTL_SECONDS=0`, cache do app no padrão (15 s) e limites
altos para não interferir: `RATE_LIMIT_MAX`, `RATE_LIMIT_IP_MAX`,
`LOGIN_RATE_LIMIT_MAX` e `ACTION_RATE_LIMIT_MAX` = 1 000 000 000. Cada
cenário só começa depois que a fila do pool esvazia.

Valores da última de 3 rodadas completas; entre parênteses, a faixa de req/s
nas 3 (ruído da máquina: ~15% nas rotas em cache, ~10% nas que vão ao
banco). "Pegar cupom": 6 rodadas.

| Rota | req/s antes → depois | p50 antes → depois | p99 antes → depois | erros antes → depois | variação req/s |
|---|---:|---:|---:|---|---:|
| app home (anônimo) | 16 → 8 216 (7 274–8 411) | 1161 → 2 ms | 1231 → 4 ms | — → — | ×514 |
| app home (logado) | 14 → 310 (297–310) | 1223 → 63 ms | 1810 → 82 ms | — → — | ×22 |
| app lojas p1 | 39 → 6 966 (6 503–7 422) | 497 → 2 ms | 732 → 4 ms | — → — | ×179 |
| app cupons p1 | 17 → 6 448 (6 228–6 646) | 1100 → 2 ms | 1403 → 4 ms | — → — | ×379 |
| app mapa | 147 → 2 976 (2 792–2 987) | 117 → 6 ms | 1218 → 9 ms | — → — | ×20 |
| painel lojas p1 | 31 → 42 (39–42) | 634 → 478 ms | 659 → 510 ms | — → — | ×1,4 |
| painel cupons pegos p1 | 1 → 35 (35–40) | 5,6 s → 493 ms | 9,2 s → 951 ms | 22 timeouts → — | ×35 |
| painel cupons pegos, cursor na posição 39 981 | novo → 704 (688–717) | → 28 ms | → 33 ms | → — | — |
| painel auditoria p1 | 0 → 40 (40–43) | 10 s → 476 ms | 10 s → 811 ms | 36 timeouts + 500 → — | de 0 para 40 |
| painel auditoria p2000 (offset 39 980) | 1 → 18 (18–23) | 10 s → 983 ms | 10 s → 1,2 s | 24 timeouts + 500 → — | ×18 |
| painel auditoria, cursor na posição 39 981 | novo → 2 356 (2 356–2 635) | → 8 ms | → 12 ms | → — | — |
| painel visitantes p1 | 2 → 108 (108–111) | 9,4 s → 182 ms | 9,9 s → 216 ms | 10 timeouts → — | ×54 |
| dashboard 30d (sem cache) | 2 → 3,9 (3,8–3,9) | 5,9 → 5,0 s | 9,9 → 5,1 s | — → 18 × 503 (15–18 por rodada) | ×1,9 |
| lookup de código (rodízio de 300 caixas) | 286 → 1 037 (1 037–1 191) | 16 → 18 ms | 18 → 30 ms | — → — | ×3,6 |
| lookup de código (1 usuário só) | — → 7 471 | → 2 ms | → 5 ms | → 120 × 200 e o resto 429 (limite fixo 120/min) | — |
| pegar cupom: 1000 visitantes × estoque 300 (50 conexões) | 333 → 456 (288–580) | 100 → 85 ms (64–151) | 174 → 177 ms (141–290) | 300 × 201, 700 × 409 `COUPON_SOLD_OUT` → **igual em todas**, **300 no banco** | ≈ igual |

**Pegar cupom (concorrência):** nas 6 rodadas sobre este banco (e em outras
8 durante a montagem do benchmark), 1000 visitantes distintos, um pedido
cada, contra um cupom novo de 300 unidades: sempre exatamente 300 × 201 e
700 × 409 `COUPON_SOLD_OUT`, nenhum 5xx nem timeout, e no banco
`count(*) = 300` pegos ativos de 300 visitantes distintos — **o estoque não
estourou**. A vazão variou de 288 a 580 req/s com o ruído da máquina (o
login dos 1000 visitantes, feito logo antes, variou de 4,4 a 7,1 s); não dá
para afirmar ganho. O "depois" mede da 1ª requisição à última resposta; o
autocannon com `amount` só termina no tique de 1 s seguinte (1000 ÷ 3 s =
333, exatamente o número do "antes", que provavelmente tem esse
arredondamento).

### EXPLAIN (ANALYZE, BUFFERS) — depois

`scripts/bench/explain.ts` roda o EXPLAIN das **mesmas classes de consulta da
API** (não uma cópia do SQL) e depois a consulta normal 3 vezes. "Real" = a
menor das 3 (cache quente, sem instrumentação), faixa de 2 execuções do
script. No PGlite a instrumentação do `EXPLAIN ANALYZE` é instável e pesa
3–5× (às vezes 50×) em consultas que tocam muitas linhas, então compare o
formato do plano e as linhas lidas mais que os milissegundos.

| Consulta | Antes (EXPLAIN) | Depois: EXPLAIN / real | Plano depois |
|---|---:|---:|---|
| painel cupons pegos p1 — página | 662 ms (`WindowAgg`, 52 MB em disco) | 0,3 / 1,5 ms | `Index Only Scan Backward` em `(claimed_at, id)`, 21 linhas; depois PK de pegos, cupom, loja, visitante e usuário só delas |
| painel cupons pegos p1 — contagem à parte | — | 135 / 27 ms | `Seq Scan` em `coupon_claims` (500 mil linhas, sem disco temporário) |
| painel cupons pegos — cursor na posição 40 mil | — | 0,6 / 1,5 ms | mesmo índice com `(claimed_at, id) < (…)`, 21 linhas, sem contagem |
| auditoria p1 — página | 312 ms (`WindowAgg`, 20 MB em disco) | 0,1 / 0,5 ms | `Index Scan` em `(created_at desc, id desc)`, 21 linhas |
| auditoria — contagem à parte | — | 160 / 22–49 ms | `Seq Scan` em `audit_logs` (500 mil linhas) |
| auditoria offset 39 980 — página | 70 ms | 78 / 22 ms | `Index Scan` percorre 40 001 entradas (o offset continua linear) |
| auditoria cursor na posição 40 mil | — | 0,1 / 0,5 ms | `Index Cond: (created_at, id) < (…)`, 21 linhas, sem contagem |
| visitantes p1 — página | 56 ms (`WindowAgg` sobre 100 mil) | 0,9 / 1,0 ms | `Index Scan Backward` em `(created_at, id)`, 20 linhas, subconsultas só delas |
| visitantes p1 — contagem | — | 31 / 8 ms | `Index Only Scan` na PK (100 mil) |
| app lojas p1 (falta no cache) | 24 ms | 48 / 23 ms | igual ao antes: `WindowAgg` + seq scan de 19 mil lojas (agora só a cada 15 s por réplica) |
| home: cupons acabando (falta no cache) | 77 ms | 162 / 51 ms | estoque derivado de 1 410 cupons × ~250 pegos (index-only em `coupon_claims_stock_idx`) |
| home logado: resumo do mês (toda requisição) | — | 4,0 / 3–4 ms | `active_claims` faz `BitmapAnd` do índice do visitante (3 linhas) com o índice parcial de ativos **inteiro** (51 mil entradas; o planner estimou 5 mil) |
| dashboard 30d — KPIs | 312 ms (seq scan pelo `OR`) | 339 / 107–114 ms | pegos: 119 mil linhas dos 60 dias; usados: `Bitmap Index Scan` em `redeemed_at`; visitantes: `Seq Scan` de 100 mil (total da base) |
| dashboard 30d — série diária | 140 ms | 230 / 125–127 ms | pegos por *skip scan* (PG 18) em `(visitor_id, claimed_at)`, 251 buscas, 119 mil linhas; usados por `redeemed_at` (30 mil) |
| dashboard 30d — demais 5 blocos | — | 350 / 167–176 ms somados | top lojas 67–71 e top cupons 65–67 (`BitmapOr` dos dois índices, 119 mil linhas), por hora 26–28, selos 7, leituras de QR 3 (index-only) |

### Conclusões

**Melhorou muito:**

- **Leituras do app** (home, lojas, cupons, mapa): de 14–147 req/s para
  3–8 mil req/s, p99 de 0,7–1,8 s para 4–9 ms. Vêm do cache compartilhado;
  o banco só é consultado na falta (a cada 15 s por réplica). O mapa fica em
  ~3 mil req/s por serializar ~38 KB (400 pinos) por resposta.
- **Listas do painel que cresciam** (cupons pegos, auditoria, visitantes):
  saíram de timeout/500 para 35–108 req/s sem erro. O `WindowAgg` com disco
  temporário sumiu; a página sai pelo índice em ~1 ms.
- **Cursor (keyset)**: custo constante em qualquer profundidade —
  auditoria na posição 40 mil a 2 356 req/s (p99 12 ms) contra 18 req/s pelo
  offset; cupons pegos a 704 req/s.
- **Pegar cupom**: estoque íntegro sob disputa (300 de 300, sempre).

**Melhorou pouco ou nada (e por quê):**

- **A contagem é agora o custo das listas.** Na p1 de cupons pegos e da
  auditoria, ~25 ms dos ~25–28 ms por requisição são o `count(*)` de 500 mil
  linhas, que cresce linear com a tabela. O cursor já elimina isso; falta o
  painel usá-lo (ou uma contagem estimada) nas listas grandes (Pendente).
- **Offset alto continua linear**: a p2000 da auditoria lê 40 mil entradas do
  índice (22 ms) + a contagem; 18 req/s. Só o cursor resolve.
- **Home logada: ×22, bem menos que a anônima.** Cada requisição roda o
  resumo do mês (camada pessoal, ~3 ms). Dentro dele, a contagem de cupons
  ativos do visitante cruza o índice dele (3 entradas) com o índice parcial
  de **todos** os ativos (51 mil) porque o planner subestima os ativos 10×.
  O custo cresce com o total de cupons ativos do sistema, não do visitante.
  Numa massa com 1,7% de ativos (8 mil) a mesma rota fez 600–700 req/s.
  Não é erro de resultado; fica no Pendente (consulta/índice só por
  visitante).
- **Dashboard sem cache: só ×1,9.** Cada carregamento ocupa a única conexão
  ~260 ms (3,9 req/s), proporcional ao volume do período (119 mil pegos em
  30 dias, 30 mil usados): KPIs ~27%, série ~30%, top lojas/cupons ~33%. A
  troca de 7 consultas paralelas por 1 transação reduz conexões, não
  trabalho. Com 20 dashboards simultâneos numa conexão a fila passa de 5 s e
  15–18 pedidos por rodada recebem **503 com `Retry-After`** — o
  `DB_CONNECTION_TIMEOUT_MS` agindo como projetado, em vez de pendurar 10 s
  (o "antes" não tinha erro só porque esperava mais). Em produção o cache de
  60 s com carregamento único por chave limita isso a 1 agregação por minuto
  por período/loja; para o sem-cache ficar barato, rollup diário (seção 4).
- **Painel lojas p1**: ×1,4 só — ainda usa `count(*) over()` sobre ~19 mil
  lojas e horários por linha; não estava no escopo.
- **Lookup de código**: o limite fixo de 120/min por usuário da equipe já
  existia no código "antes", mas aquela rodada teve 2 858 × 200 e nenhum 429;
  com um usuário só, o depois responde 120 × 200 e 429 no resto. O número
  comparável é o rodízio entre 300 caixas: 1 037–1 191 req/s, p99 19–30 ms.

**Bug encontrado pela medição (corrigido):** o log "Consulta lenta" media a
espera na fila do pool junto com a consulta. Sob carga, a consulta de página
da auditoria (0,5 ms) foi registrada 765 vezes como lenta, e uma rodada
gerou 1 635 avisos — o log apontava as consultas erradas justamente quando
importa. `Database.query` agora pega a conexão antes de iniciar o cronômetro
(mantendo o descarte da conexão em erro, como o `pool.query`); teste em
`database.integration.test.ts`. Na rodada seguinte: 2 avisos.

## 3. Como escalar horizontalmente

A API é stateless (JWT, sessões no banco, imagens no Storage). Para N réplicas:

1. **Pool × pooler.** `N × DB_POOL_MAX + N (escuta de cache, se ligada) +
   folga para migrations/console ≤ limite do pooler do projeto`. Ex.: limite
   60 → 4 réplicas × 12. Sinal de pool pequeno: `db_pool_waiting > 0`
   sustentado em `/metrics` ou 503 `Serviço ocupado` nos logs.
2. **Modo session obrigatório** (porta 5432 do pooler): advisory locks dos
   jobs e migrations, `SET` dos timeouts por sessão e `LISTEN`.
3. **Jobs**: rodam em todas as réplicas, mas cada rodada pega
   `pg_try_advisory_lock` — só uma executa. Lotes curtos, `SKIP LOCKED`.
4. **Cache**: por réplica. Uma escrita no painel limpa o cache da réplica que
   a recebeu; as outras convergem no TTL (15 s). Se isso incomodar, ligue
   `CACHE_INVALIDATION=postgres` (LISTEN/NOTIFY no próprio banco, uma conexão
   a mais por réplica).
5. **Rate limit**: o limite global é por réplica (com N réplicas o teto
   efetivo é N×). As rotas sensíveis (login e cadastro do app e do painel,
   refresh do app, pegar cupom, ler QR) contam juntas com
   `RATE_LIMIT_STORE=postgres` (tabela `platform.rate_limit_hits`
   UNLOGGED, um upsert por requisição só nessas rotas; se o banco falhar,
   conta em memória e não derruba a rota). Ligue quando houver mais de uma
   réplica atrás de balanceador.
6. **Chave do rate limit**: usuário/visitante do token quando há token
   válido; IP só para anônimo, com teto próprio (`RATE_LIMIT_IP_MAX`), porque
   no wi-fi do complexo muitos visitantes saem pelo mesmo IP.
7. **Encerramento**: `SHUTDOWN_DRAIN_MS` (~5 s atrás de balanceador) faz a
   readiness (`/api/v1/health`) responder 503 antes de parar de aceitar
   conexões; `stop_grace_period` do orquestrador > `SHUTDOWN_TIMEOUT_MS`.
8. **Health**: liveness `/health/live` (sem banco — Supabase fora não
   reinicia réplicas); readiness `/api/v1/health` (com banco, 503 no dreno).

## 4. Particionamento futuro

- `audit.audit_logs` e `gamification.qr_scans` só crescem. Quando passarem de
  ~20–50 milhões de linhas (ou o vacuum começar a pesar), particionar por mês
  em `created_at`/`scanned_at` (`partition by range`), com a PK incluindo a
  coluna de data. As consultas já filtram/ordenam pela data e a paginação
  por cursor `(created_at, id)` funciona igual em tabela particionada.
  Retenção vira `drop` de partição antiga (sem `delete` em massa).
- `coupon_claims`: manter inteira enquanto couber em memória; o caminho
  quente usa índices por cupom/visitante.
- Rollup diário do dashboard (`(dia, cupom) → pegos/usados/economia`) se o
  período de 90 dias com loja passar de ~1 s mesmo com cache.

## 5. Checklist de produção

- [ ] `DATABASE_URL` do pooler em **modo session** (porta 5432), API na mesma região do Supabase.
- [ ] `DB_POOL_MAX` × réplicas dentro do limite do pooler; `DB_CONNECTION_TIMEOUT_MS` ~5 s.
- [ ] `DB_STATEMENT_TIMEOUT_MS` (30 s), `DB_LOCK_TIMEOUT_MS` (10 s), `DB_IDLE_IN_TRANSACTION_TIMEOUT_MS` (60 s).
- [ ] `TRUST_PROXY` com o número certo de saltos (senão o rate limit por IP vê o IP do proxy).
- [ ] Mais de uma réplica: `RATE_LIMIT_STORE=postgres`; avaliar `CACHE_INVALIDATION=postgres`.
- [ ] `SHUTDOWN_DRAIN_MS=5000` atrás de balanceador; `stop_grace_period` ≥ 30 s.
- [ ] Healthcheck do container em `/health/live`; balanceador em `/api/v1/health`.
- [ ] `HTTP_KEEP_ALIVE_TIMEOUT_MS` maior que o keepalive do proxy (72 s > 60 s).
- [ ] `METRICS_ENABLED=true` com `METRICS_TOKEN`; alertas em `db_pool_waiting`, p99 e event loop.
- [ ] Índices novos: em tabela já grande, criar antes com `CREATE INDEX CONCURRENTLY` (mesmo nome).
- [ ] Logs: nível `info`, `requestId` em todas as linhas (inclusive "Consulta lenta").

## 6. O que mudou (referência)

- **Migration** `supabase/migrations/20261101001100_scalability.sql`:
  `marketing.highlight_daily_metrics` (+ cópia dos totais antigos; colunas
  `impressions/clicks` viram legado, sem escrita), `platform.rate_limit_hits`
  (UNLOGGED, RLS ligado), índices `(claimed_at, id)`, `(created_at desc, id
  desc)` da auditoria, `(created_at, id)` de visitantes, `(earned_at, id)`,
  `(scanned_at) include (result)` e parcial de sessões rotacionadas (os
  índices de uma coluna que viraram prefixo foram removidos).
- **Banco** (`shared/infra/database`): timeouts por `SET` na conexão nova
  (client do pool próprio), `lock_timeout`, `idle_in_transaction_session_timeout`,
  `maxLifetimeSeconds`, estatísticas do pool, `requestId` no log de consulta
  lenta (só o tempo da consulta: a espera na fila do pool não conta, desde a
  rodada "depois"); sobrecarga (pool sem conexão, `statement_timeout`,
  `lock_timeout`) → 503.
- **App** (`modules/app-api`): `AppReads` (camada compartilhada em cache +
  pessoal), métricas de destaque em lote, limites por visitante em pegar
  cupom/ler QR, refresh limitado por IP.
- **HTTP** (`shared/infra/http`): ETag/304, `Cache-Control`, gzip/br sem
  dependência nova, rate limit híbrido, `/health/live`, `/metrics` opcional,
  invalidação declarada por router (`invalidates`), timeouts do servidor.
- **Paginação por cursor** (aditiva no contrato): `?cursor=` em
  `GET /coupon-claims` e `GET /audit-logs`; `meta.nextCursor` (opcional em
  todas as páginas); no modo cursor `meta.total = -1`.

## 7. Como repetir a medição

Os scripts do benchmark (`inflate.ts`, `run.ts`, `explain.ts` com
autocannon) e a suíte de testes saíram do repositório em 01/11/2026; estão
no histórico do git até o commit `836c69e` (`apps/api/scripts/bench/`).

## Pendente

- **Contagem das listas grandes**: com a página pelo índice, o `count(*)`
  separado virou quase todo o custo da p1 (~25 ms com 500 mil linhas,
  linear). Fazer o painel usar o cursor (`meta.nextCursor`) em cupons pegos e
  auditoria, ou mostrar contagem estimada (`pg_class.reltuples`) sem filtro.
- **Dashboard sem cache** ainda custa ~260 ms por carregamento com 500 mil
  pegos (proporcional ao período): rollup diário (seção 4). Barato e
  imediato: os KPIs/série fazem `join` com `coupons` mesmo sem filtro de loja.
- **Painel lojas p1** e a falta de cache de **app lojas** ainda usam
  `count(*) over()` sobre ~19 mil lojas (24 ms; não estava no escopo).
- **Resumo do mês (home logada, toda requisição)**: a contagem de cupons
  ativos do visitante (`VisitorQueries.monthSummary`) vira `BitmapAnd` com o
  índice parcial de todos os ativos (51 mil entradas lidas para achar 3) por
  estimativa errada do planner. Medir num Postgres real e, se repetir, índice
  `(visitor_id) where status = 'active'` ou consulta que não use o índice de
  vencimento.
- ~~Validação com Docker~~ feita em 01/11: build das duas imagens; as 12
  migrations aplicadas num **PostgreSQL 17** real (até então só PGlite);
  seed com as 29 imagens; os três containers saudáveis; pelo nginx em :8082
  SPA, assets com gzip e cache imutável, login com cookie `arp_rt`, refresh,
  upload e `/uploads`, `X-Request-Id` no log; API em :3002. Smoke do painel
  (`SMOKE_BASE_URL=http://localhost:8082`) 55/55 sem erro nos logs. Teste de
  LISTEN/NOTIFY com `ARP_TEST_PG_URL` contra o Postgres do compose: 13/13.
- ~~nginx e compose~~ feito em 01/11: upstream com `keepalive` e `resolve`
  (réplicas entram sem reiniciar o nginx), `X-Request-Id` repassado ou gerado,
  timeouts de proxy, gzip no nginx (`Accept-Encoding ""` para a API), log com
  tempo de upstream; limites de CPU/memória e `NODE_OPTIONS` no compose.
  Para várias réplicas: `docker compose up -d --scale api=N` sem publicar a
  porta 3002 em todas (o nginx em 8082 balanceia).
- Remover as colunas legadas `highlights.impressions/clicks` numa migration
  futura (depois que nenhuma réplica antiga estiver rodando).
- Contador materializado de estoque para cupons com dezenas de milhares de unidades.
- Paginar o público no envio de push.
