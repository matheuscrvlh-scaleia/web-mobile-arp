# Arquitetura — ERP do App ARP

Painel de gestão do **app do visitante ARP** (React Native/Expo, feito depois).
Tudo que o app mostra ou faz é cadastrado, acompanhado e moderado aqui:
lojas, mapa por andar, agenda, cupons com estoque e prazo, desafios mensais
com selos por QR Code, destaques patrocinados, notificações, visitantes.

- **API**: Node 22 + Fastify 5 + TypeScript, Clean Architecture por módulo.
- **Web**: React 19 + Vite + Tailwind CSS 4 + TypeScript.
- **Banco**: PostgreSQL do **Supabase**, usado **só como armazenamento**
  (dados no Postgres, imagens no Supabase Storage). **Sem ORM**: SQL escrito à
  mão com `pg` (node-postgres), parametrizado. Auth, regras, permissões, jobs:
  tudo no nosso código. Nada de Supabase Auth, PostgREST, RLS por usuário ou
  Edge Functions.
- **Contratos**: `packages/contracts` (Zod 4) é a fonte única dos DTOs, das
  permissões e das rotas. API valida com eles; web tipa e valida forms com eles.
- **Auth**: JWT de acesso curto (15 min, header `Authorization: Bearer`) +
  refresh token opaco rotativo (30 dias) em cookie httpOnly; RBAC por permissão.

Idioma: **código em inglês**, **interface e mensagens em pt-BR**. Comentários em
pt-BR, curtos, explicando o porquê (não o quê).

---

## 1. Monorepo

```
erp-mobile-arp/
├─ apps/
│  ├─ api/                  # @arp/api  — Fastify (porta interna 3000, externa 3002)
│  └─ web/                  # @arp/web  — React/Vite servido por nginx (interna 80, externa 8082)
├─ packages/
│  └─ contracts/            # @arp/contracts — schemas Zod, tipos, permissões, rotas
├─ supabase/
│  └─ migrations/           # <timestamp>_<nome>.sql — SQL puro, formato do Supabase CLI
├─ docs/                    # este arquivo, modelo de dados, decisões
├─ docker-compose.yml
├─ biome.json  tsconfig.base.json  package.json (npm workspaces)
```

`@arp/contracts` é consumido **como fonte TS** (`exports: ./src/index.ts`):
o Vite compila no web; na API o `tsx` roda em dev e o `tsup` empacota no build
(`noExternal: ["@arp/contracts"]`).

---

## 2. API — Clean Architecture (monólito modular)

```
apps/api/src/
├─ main.ts                       # sobe o servidor, graceful shutdown
├─ app.ts                        # buildApp(): plugins, rotas, error handler (testável)
├─ container.ts                  # composition root: instancia repos/serviços/casos de uso
├─ config/env.ts                 # env validado com Zod (falha cedo)
├─ shared/
│  ├─ domain/                    # DomainError e subclasses + orNotFound, applyPatch (PATCH
│  │                             #   parcial), fuso de SP/Phase, slugify (sem dependências)
│  ├─ application/               # portas: Clock, PasswordHasher, TokenService, Storage,
│  │                             #   Cache, AuditLogger, UnitOfWork, PushSender, SecureRandom,
│  │                             #   ImageProcessor; Actor, escopo de loja, paginação (Page,
│  │                             #   toPage, keyset), miniaturas (ImageVariants, ImageCleanup)
│  └─ infra/
│     ├─ database/               # Database (pg Pool, one/maybeOne/many/exists, transaction via
│     │                          #   AsyncLocalStorage), sql``, tradução de constraint, migrate, seed
│     ├─ http/                   # router (rotas do contrato), auth/authorize, error-handler,
│     │                          #   rate-limit, cache HTTP (ETag/gzip), métricas, rotas de sistema
│     ├─ presenters.ts           # iso/isoOrNull/hhmmOrNull/toDate (banco ↔ fio)
│     ├─ security/               # Argon2PasswordHasher, JoseTokenService
│     ├─ storage/                # LocalDiskStorage: disco do servidor (volume "uploads"
│     │                          #   na VPS), servido pela API em /uploads
│     ├─ images/                 # SharpImageProcessor (miniaturas WebP), colunas de imagem,
│     │                          #   referências para a limpeza e backfill (images:thumbnails)
│     ├─ cache/                  # MemoryCache (TTL curto) e PgNotifyCache (invalidação entre
│     │                          #   réplicas por LISTEN/NOTIFY) atrás da porta Cache
│     └─ jobs/                   # agendador com trava distribuída (pg advisory lock)
└─ modules/
   ├─ identity/      # login, refresh, logout, me, trocar senha, usuários, cargos
   ├─ directory/     # andares, blocos, categorias, lojas+horários, pontos do mapa, métricas
   ├─ promotions/    # cupons, claims (pegar, validar, expirar)
   ├─ gamification/  # selos, campanhas, faixas, desafios, QR Codes, selos conquistados
   ├─ agenda/        # categorias de evento, eventos, ocorrências
   ├─ marketing/     # destaques, notificações push
   ├─ visitors/      # visitantes (lista, detalhe, bloqueio)
   ├─ dashboard/     # indicadores (somente leitura, consultas agregadas)
   ├─ platform/      # configurações do app, histórico (auditoria), uploads, health
   ├─ app-api/       # rotas do app mobile (/api/v1/app/*) reusando os casos de uso
   └─ merchant/      # painel do lojista no app (/api/v1/app/merchant/*): login da
                     #   equipe com refresh no corpo, caixa e números da loja
```

Cada módulo:

```
modules/<modulo>/
├─ domain/           # entidades com regras (ex.: Coupon.claim()), value objects,
│                    # interfaces de repositório (portas), erros do domínio
├─ application/      # um caso de uso por arquivo: class XxxUseCase { execute(input, actor) }
│                    # orquestra domínio + portas; não conhece Fastify nem SQL
├─ infra/            # Pg<Entidade>Repository implementa a porta (SQL à mão);
│                    # <modulo>.queries.ts: consultas de leitura que devolvem o DTO;
│                    # fragments.ts: trechos de SQL repetidos dentro do módulo
├─ http/             # <modulo>.routes.ts: registra as rotas de ROUTES.<modulo> com os
│                    # schemas do contracts, chama o caso de uso e devolve o DTO lido
│                    # pela query service ("busca ou 404" com orNotFound)
└─ index.ts          # create<Modulo>Module(core): monta repositórios e casos de uso; é a
                     # API pública do módulo (outros módulos importam só daqui)
```

### Regras de dependência (não negociáveis)

- `domain` não importa nada de fora dele (nem Zod, nem pg, nem Fastify).
- `application` importa `domain` e portas de `shared/application`. Nunca `infra`.
  Tipos de DTO do `@arp/contracts` são aceitos quando o caso de uso devolve uma
  leitura pronta (dashboard, consulta de código no caixa).
- `infra` implementa portas; é o único lugar com SQL e com o cliente do Supabase.
  Não importa de `http` (os presenters ficam em `shared/infra/presenters.ts`).
- Um módulo usa outro pelo `index.ts` dele (ex.: o app-api recebe `ClaimCouponUseCase`
  e `SessionService` prontos no container).
- `http` só faz: validar (schema do contracts), extrair o `Actor`, chamar o caso
  de uso, devolver o DTO. Sem regra de negócio no handler.
- Injeção manual no `container.ts` (sem framework de DI): legível e tipado.
- Datas no domínio são `Date`; no fio são strings ISO (presenter converte).
- Dinheiro em centavos (inteiro). Ids `uuid` v7 gerados pelo banco
  (`public.uuid_generate_v7()`, função plpgsql da migration inicial — o
  Postgres do Supabase ainda não tem `uuidv7()` nativo).

### SQL sem ORM

- `Database` (shared/infra/database) embrulha o `pg.Pool`: `query<T>(sql)`,
  `one<T>`, `maybeOne<T>`, `many<T>` e `transaction(fn)`. A transação corre em
  `AsyncLocalStorage`: repositórios chamados dentro de `transaction()` usam o
  mesmo client sem receber parâmetro extra (é a implementação da porta
  `UnitOfWork`).
- Toda query é parametrizada: template tag `sql\`… ${valor} …\`` que gera
  `{ text, values }` com `$1..$n`; `sql.join`, `sql.raw` (só para trechos
  fixos do código, nunca entrada do usuário) e `sql.empty` para montar filtros.
  Nunca concatenar entrada do usuário em SQL.
- Cada repositório tem a interface da linha (`StoreRow`) e um `<entidade>ToDomain()`;
  cada query service, um `to<Dto>()`. Colunas no SELECT explícitas (nada de
  `select *` em código de produção); colunas/joins repetidos viram fragmento
  (`COUPON_COLUMNS`, `USER_FROM`, `HIGHLIGHT_SELECT`).
- Existência: ``db.exists(sql`select 1 …`)``. LIKE com texto do usuário:
  `sql.containsPattern(q)` (busca sem acento) ou `escapeLike(texto)`.
- Constraint do banco → erro de domínio no repositório:
  `translateConstraintErrors(() => escrita, { users_email_key: () => new ConflictError(…) })`
  e, para apagar algo ainda referenciado, `translateInUseError(…)`. O error handler
  só tem uma rede de segurança genérica (409/400).
- Paginação: listas pequenas usam `count(*) over()` na mesma query (`toPage`);
  listas que crescem sem parar (visitantes, cupons pegos, auditoria) paginam pelo
  índice com a contagem numa consulta enxuta à parte (`toCountedPage`) ou por
  cursor/keyset sem contagem (`toKeysetPage`, `?cursor=`).
- Conexão: `DATABASE_URL` do Supabase (pooler em modo **session**, porta 5432,
  por causa dos advisory locks e prepared statements). `ssl` ligado quando o
  host não é local. Pool pequeno por instância (`DB_POOL_MAX`, padrão 10).
- Fuso do negócio: `America/Sao_Paulo` (aberto agora, mês da campanha, dashboard).

### Leitura x escrita (CQRS leve)

Escritas passam pela entidade (regras + invariantes) e pelo repositório.
Listagens e painéis com joins/agregações usam **query services** no `infra`
(retornam o DTO de leitura direto, sem hidratar entidades) — evita N+1 e
cerimônia onde não há regra. A rota de escrita chama o caso de uso (que devolve
o id) e responde com o DTO lido pela query service — o mesmo do `GET /:id`.
Listagens que crescem são paginadas no banco; cadastros pequenos (andares,
categorias, destaques, selos) vêm inteiros, e o editor do mapa lê todas as lojas
do andar de uma vez (`GET /floors/:id/pins`, só os campos do pino).

PATCH: o contrato monta o corpo com `patchOf` (sem defaults); a entidade aplica só
os campos presentes com `applyPatch` (undefined mantém, null limpa) e valida o
estado final.

### Erros

`DomainError(code, message, status)` com subclasses (`NotFoundError`,
`ConflictError`, `ForbiddenError`, `BusinessRuleError`…). O error handler
global converte para `{ error: { code, message, details?, requestId } }`
(ver `apiErrorSchema`). Erro de validação Zod → `VALIDATION_ERROR` 400 com
`details` por campo. Erro inesperado → 500 `INTERNAL_ERROR` sem vazar stack.

### Autenticação e autorização

- **Login** (`POST /auth/login`): argon2id; mensagem genérica em falha;
  rate limit agressivo por IP+e-mail. Devolve `{ accessToken, expiresIn, user }`
  e grava o refresh no cookie `arp_rt` (httpOnly, `SameSite=Strict`,
  `Path=/api/v1/auth`, `Secure` em produção).
- **Access token** (JWT HS256, `jose`): `sub`, `aud: "admin"`, `role`,
  `perms` (permissões), `store` (id da loja do lojista ou null), `exp` 15 min.
- **Refresh token**: opaco (32 bytes aleatórios), salvo **só o hash** (SHA-256)
  em `identity.sessions`. Rotação a cada uso; reuso de um token já rotacionado
  revoga a família inteira (detecção de roubo). **Tolerância**
  (`REFRESH_REUSE_GRACE_SECONDS`, 60 s): reapresentar o token anterior logo
  depois da troca, com o sucessor ainda sem uso (resposta perdida na rede,
  duas requisições juntas), emite outro token na mesma família em vez de
  derrubar o login; o primeiro irmão usado revoga os outros.
- **RBAC**: cada rota declara `permission` (de `ROUTES`); o plugin
  `authorize` confere em `request.actor.permissions`. Mudança de cargo vale no
  próximo refresh (≤ 15 min) — aceitável e sem consulta por request.
- **Escopo de loja**: ator com `storeId` (lojista) tem os filtros de loja
  forçados nas leituras e só valida cupom da própria loja (`CLAIM_WRONG_STORE`).
- **App mobile**: audiência `app`, tokens separados; refresh vai no corpo
  (sem cookie). Mesmo mecanismo de sessão. Limite do refresh por token (não
  por IP: o wi-fi do complexo sai por um NAT só). Logout com `pushToken`
  (ou `DELETE /app/push-tokens`) desvincula o push do aparelho.
- **Lojista no app** (`App.MERCHANT_ROUTES`, `/api/v1/app/merchant/*`): quem
  entra é usuário do painel com `coupons.redeem` e ao menos uma loja. Usa a
  **audiência `admin`** (sem migration nova): o access token é o mesmo do
  painel (Bearer; as rotas do painel e o RBAC valem igual, ex.
  `/auth/change-password` quando `mustChangePassword`), e desativar, resetar
  ou trocar a senha derruba também o app. Diferença: o refresh vai no
  **corpo** de `merchant/auth/refresh|logout` (sem cookie). Login com as regras
  do painel (genérico, mesmo tempo, auditoria `auth.login` com
  `channel: merchant_app`, limite por IP+e-mail); senha certa sem
  `coupons.redeem`/loja → 403 sem abrir sessão. No refresh: desativado → 401 e
  todos os logins caem; perdeu a permissão ou a loja → 403 e só esse login cai.
  Loja: lojista sempre a dele; usuário sem loja (admin, atendimento) recebe as
  lojas ativas (`allStores: true`) e manda `storeId` em cada chamada (omitir
  só vale com uma única loja ativa → senão `VALIDATION_ERROR`). O caixa
  (`claims/lookup|redeem`, `coupons.redeem`, 120/min por usuário) chama os
  mesmos casos de uso do painel com o ator preso à loja escolhida — mesmos
  erros (`NOT_FOUND`, `CLAIM_*`) e auditoria `claim.redeem` — e devolve do
  visitante só o primeiro nome. `merchant/overview?period=today|week|month`
  (`coupons.view`): cupons no ar com estoque, usos por hora e últimos 10 usos
  com código mascarado, em dias de São Paulo (semana/mês = janelas 7d/30d do
  dashboard); cache ≤ 15 s por loja, limpo quando o app usa um código.
- **Login social do app** (`POST /app/auth/social`): o app manda o `id_token`
  do Google/Apple; a API valida com `jose` pela JWKS do provedor (RS256,
  emissor, audiência em `GOOGLE_CLIENT_IDS`/`APPLE_CLIENT_IDS`, validade,
  `nonce` se vier, `email_verified`). Porta `SocialIdentityVerifier`
  (JWKS injetável: os testes usam chaves locais). Conta = um método:
  (provedor, `sub`) achado entra; e-mail de conta de outro método →
  409 `EMAIL_USES_OTHER_LOGIN` (sem vínculo automático); conta nova exige
  `acceptTerms` (senão 422 `TERMS_REQUIRED`). Provedor sem client id → 503
  `SERVICE_UNAVAILABLE`, sem quebrar a subida.
- **Esqueci a senha do app** (`POST /app/auth/password/forgot` e `/reset`):
  código de 6 dígitos por e-mail (porta `Mailer`: driver `log` em dev, `smtp`
  com nodemailer; produção sem driver → 503). `forgot` sempre 204 (não revela
  cadastro); só conta por senha e ativa recebe. No banco só o HMAC-SHA256 do
  código (`visitors.password_resets`), validade `PASSWORD_RESET_CODE_TTL_MINUTES`,
  5 tentativas, pedido novo invalida o anterior. `reset` troca a senha, gasta o
  código, derruba todas as sessões do app e devolve uma sessão nova. Mesmo
  rate limit do login (IP + e-mail; no social, IP + e-mail do token).

### Auditoria

Toda escrita do painel registra em `audit.audit_logs` (ator, ação
`entidade.acao`, entidade, diff `{campo:{from,to}}`, IP) pela porta
`AuditLogger`, **na mesma transação** da escrita.

### Jobs

`shared/infra/jobs`: agendador em processo com `pg_try_advisory_lock` (só uma
réplica executa cada job). Jobs: expirar claims vencidos (a cada minuto),
disparar notificações agendadas (a cada minuto, envio por porta
`PushSender` — adaptador de log até integrar Expo Push), limpar sessões
vencidas/rotacionadas, apagar códigos de nova senha vencidos (a cada hora) e,
com `RATE_LIMIT_STORE=postgres`, o contador de rate
limit. `JOBS_ENABLED=false` desliga todos (ex.: réplica só de leitura, testes).

---

## 3. Banco de dados

PostgreSQL do Supabase (compatível com 15+; em dev, `postgres:17-alpine`
local). **Um schema por domínio**. Convenções:

- Tabelas e colunas em `snake_case`, tabelas no plural.
- PK `id uuid default public.uuid_generate_v7()` (exceto `audit_logs`: `bigint identity`).
- `created_at`/`updated_at timestamptz not null default now()`.
- Status como `text` + `CHECK` (mais simples de evoluir que enum nativo).
- FKs com `ON DELETE RESTRICT` por padrão (apagar = desativar/arquivar);
  `CASCADE` só em tabelas filhas puras (horários, faixas, favoritos).
- Busca sem acento: extensão `unaccent` + função imutável `public.f_unaccent`
  e índices `gin (f_unaccent(lower(nome)) gin_trgm_ops)` com `pg_trgm`.
- E-mails únicos via índice em `lower(email)`.
- Extensões no schema `extensions` (padrão do Supabase; a migration cria o
  schema se não existir, para rodar igual no Postgres local).
- **Migrations em SQL puro** em `supabase/migrations/<AAAAMMDDHHMMSS>_<nome>.sql`
  (nunca editar uma já aplicada; mudança = nova migration). O runner da API
  (`npm run db:migrate`, e na subida do container) aplica cada arquivo numa
  transação e registra em `supabase_migrations.schema_migrations` — a mesma
  tabela do Supabase CLI, então `supabase db push` e o runner convivem.
- **Segurança no Supabase**: nossos schemas não são expostos na API REST do
  Supabase; ainda assim toda tabela tem `enable row level security` sem
  políticas e `revoke all … from anon, authenticated`. Só a API (role
  `postgres`/dona das tabelas) lê e grava.
- **Imagens**: disco do servidor (volume `uploads` da VPS), gravado só pela API
  e servido por ela em `/uploads/` (atrás do nginx). Nada vai para o Supabase.
  O banco guarda a URL pública absoluta (`STORAGE_PUBLIC_BASE_URL` + `/uploads/…`,
  o app mobile precisa dela). Caminho: `<pasta>/<AAAA>/<MM>/<uuid>.<ext>`.
- **Miniaturas**: o upload (`POST /uploads`) gera com `sharp`, antes de
  responder, uma WebP por largura de `IMAGE_WIDTHS` (160 lista/avatar, 480
  card, 960 detalhe), ao lado da original: `<uuid>.<ext>` →
  `<uuid>_w480.webp`. Largura máxima sem ampliar, orientação do EXIF
  aplicada, metadados removidos, `limitInputPixels` de 40 MP (bomba de
  descompressão) e o mesmo cache longo da original. Nada muda no banco nem
  nos DTOs: o app e o painel montam a URL com `imageVariantUrl(url, largura)`
  de `@arp/contracts` (URL sem `<uuid>.<ext>` no fim, como link externo, volta
  igual). Não usamos o "image transformation" do Supabase (pago e inexistente
  no driver local).
  - O seed grava as imagens como `seed/<pasta>/<uuid do conteúdo>.<ext>` (uuid
    derivado do sha256: mesmo padrão dos uploads) e gera as miniaturas que
    faltarem.
  - Trocar ou apagar imagem (loja, cupom, evento, destaque) apaga original +
    miniaturas depois do commit, se nenhuma outra linha usa a mesma URL
    (`ImageCleanup`; falha só vira log). As colunas de imagem ficam em
    `IMAGE_URL_COLUMNS` (`shared/infra/images`): coluna nova entra lá.
  - Backfill (imagens antigas, idempotente, só gera o que falta):
    `npm run images:thumbnails -w @arp/api [-- --concurrency=4 --dry-run]`,
    com `DATABASE_URL` e `STORAGE_*` do ambiente alvo (rodar no servidor, onde está o volume). Rodar
    depois de publicar a versão que gera miniaturas.

### identity

| tabela | colunas principais | notas |
|---|---|---|
| `roles` | id, name (único), description, permissions `text[]`, is_system | Administrador é `is_system` |
| `users` | id, name, email, password_hash, role_id → roles, store_id → directory.stores (null), status (`active`/`disabled`), must_change_password, last_login_at, created_at, updated_at | `unique(lower(email))` |
| `sessions` | id, audience (`admin` = painel e lojista no app / `app` = visitante), subject_id, family_id, token_hash (único), expires_at, revoked_at, replaced_by_id, user_agent, ip, created_at, last_used_at | índice (subject_id, audience); limpeza de expiradas |

### directory

| tabela | colunas principais | notas |
|---|---|---|
| `floors` | id, level (único), label, short_label, layout `jsonb` (MapShape[]) | desenho no viewBox 360×470 |
| `blocks` | id, name (único), sort_order | "Bloco 80" |
| `store_categories` | id, name, kind (`food`/`shop`), icon, sort_order | unique(name, kind) |
| `stores` | id, slug (único), name, category_id, block_id, floor_id, description, icon, brand_color, cover_image_url, logo_url, phone, whatsapp, instagram, website, map_x, map_y, status | índices em category/floor/status + trigram no nome |
| `store_hours` | store_id → stores (cascade), weekday 0–6, opens_at `time`, closes_at `time` | PK (store_id, weekday) |
| `map_points` | id, floor_id → floors (cascade), icon, label, x, y | |

### promotions

| tabela | colunas principais | notas |
|---|---|---|
| `coupons` | id, store_id, title, headline, headline_sub, description, schedule_note, starts_at, ends_at, total_quantity, redeem_window_hours, tone, icon, image_url, savings_cents, status (`draft`/`active`/`paused`/`ended`), created_by → identity.users | CHECK total > 0, window 1–720 |
| `coupon_claims` | id, coupon_id, visitor_id → visitors.visitors, code (único, `ARP-XXXXXX`), status (`active`/`redeemed`/`expired`/`cancelled`), claimed_at, expires_at, redeemed_at, redeemed_by → identity.users, created_at, updated_at | **unique parcial (coupon_id, visitor_id) where status='active'**; índices (coupon_id, status), (visitor_id, claimed_at desc), (expires_at) where status='active' |

**Pegar cupom (concorrência)**: transação com `SELECT … FROM coupons WHERE id=$1 FOR UPDATE`,
conta ativos-no-prazo + usados, recusa se `>= total`, insere o claim. O `FOR
UPDATE` serializa só os pedidos do mesmo cupom. Código gerado com
`crypto.randomInt` no alfabeto sem ambíguos (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`),
retry em colisão. Claim ativo com `expires_at < now()` já conta como devolvido
na leitura; o job só materializa o status `expired`.

### gamification

| tabela | colunas principais | notas |
|---|---|---|
| `seals` | id, slug (único), name, description, icon, gradient_from, gradient_to, sort_order, status (`active`/`archived`) | |
| `campaigns` | id, name, description, starts_at, ends_at, status (`draft`/`published`/`archived`) | CHECK ends_at > starts_at |
| `reward_tiers` | id, campaign_id (cascade), threshold, label, icon | unique(campaign_id, threshold) |
| `challenges` | id, campaign_id, seal_id, title, how_to, icon, validation (`qr`/`auto`), store_id (null), event_id → agenda.events (null), sort_order, status | |
| `qr_codes` | id, challenge_id, token (único, 24+ chars aleatórios url-safe), label, valid_from, valid_until, status (`active`/`revoked`), created_at | payload = `arp://selo/<token>` |
| `earned_seals` | id, visitor_id, challenge_id, seal_id, campaign_id, qr_code_id (null), earned_at | **unique(visitor_id, challenge_id)**; índices (campaign_id, visitor_id), (earned_at) |
| `qr_scans` | id, qr_code_id (null se token inválido), visitor_id, result (`awarded`/`duplicate`/`expired`/`invalid`), scanned_at | analytics; índice (qr_code_id, result) |

### agenda

| tabela | colunas principais | notas |
|---|---|---|
| `event_categories` | id, name (único), icon, sort_order | |
| `events` | id, title, category_id, description, image_url, tone, icon, place, floor_id (null), store_id (null), recurrence (`single`/`range`/`weekly`), starts_on `date`, ends_on `date`, weekday, start_time `time`, end_time `time`, is_long_running, awards_seal, status (`draft`/`published`/`cancelled`) | CHECKs de coerência da recorrência; índice (status, starts_on, ends_on) |
| `event_interests` | visitor_id, event_id (cascade), created_at | PK (visitor_id, event_id) |

### visitors

| tabela | colunas principais | notas |
|---|---|---|
| `visitors` | id, name, email, phone, password_hash (null em login social), auth_provider (`password`/`google`/`apple`), provider_subject, avatar_url, marketing_opt_in, terms_accepted_at, status (`active`/`blocked`), blocked_reason, last_seen_at | `unique(lower(email))`; trigram em nome/e-mail |
| `favorite_stores` | visitor_id (cascade), store_id (cascade), created_at | PK composta |
| `store_follows` | visitor_id (cascade), store_id (cascade), created_at | "Avisar ofertas" |
| `push_tokens` | id, visitor_id (cascade), token (único), platform (`ios`/`android`), created_at, last_seen_at | Expo push |
| `password_resets` | id, visitor_id (cascade), code_hash (HMAC), expires_at, attempts, used_at, created_at | código de nova senha do app; só o último vale; limpeza por job |

### marketing

| tabela | colunas principais | notas |
|---|---|---|
| `highlights` | id, title, subtitle, cta_label, image_url, badge (`featured`/`sponsored`), target_type, target_id, target_url, sponsor_store_id (null), starts_at, ends_at, sort_order, status | índice (status, starts_at, ends_at). `impressions`/`clicks` são legadas (não lidas nem gravadas; sairão numa migration depois do deploy) |
| `highlight_daily_metrics` | highlight_id (cascade), day, impressions, clicks | PK (highlight_id, day); a API acumula em memória e grava em lote; os totais do painel somam os dias |
| `push_notifications` | id, title, body, audience (`all`/`opted_in`/`store_followers`), store_id, deep_link, scheduled_at, sent_at, status (`draft`/`scheduled`/`sent`/`cancelled`), recipients_count, created_by → identity.users | índice (status, scheduled_at) |

### platform

| tabela | colunas principais | notas |
|---|---|---|
| `settings` | key (PK), value `jsonb`, updated_by, updated_at | uma linha por chave de `appSettingsSchema` |

### audit

| tabela | colunas principais | notas |
|---|---|---|
| `audit_logs` | id `bigint identity`, actor_type, actor_id, actor_name, action, entity_type, entity_id, changes `jsonb`, ip `inet`, user_agent, created_at | índices (entity_type, entity_id), (actor_id), (created_at desc). Candidata a particionamento mensal por `created_at` quando crescer |

---

## 4. Web — React

```
apps/web/src/
├─ main.tsx
├─ app/                      # App, providers (QueryClient, Auth, Theme, Toast), router
│  ├─ router.tsx             # rotas com lazy() por feature, guardas de permissão
│  └─ layout/                # AppShell: Sidebar de vidro, TopBar (onde estou, data, Ctrl+K)
├─ shared/
│  ├─ api/                   # http client (fetch): Bearer, refresh único em 401, ApiError tipado
│  ├─ ui/                    # design system: Card, Button, Field/Input/Select/Textarea,
│  │                         #   Modal, ConfirmDialog, Table, Pagination, Tabs (pílula),
│  │                         #   Status/Badge, PageHeader, EmptyState, Skeleton, Toast,
│  │                         #   IconPicker, ImageUpload, ColorInput, Switch, Kpi, charts
│  ├─ hooks/                 # useDebounce, usePermission, useQueryParams…
│  └─ lib/                   # format (moeda, datas pt-BR), cn(), icons (lucide por nome)
├─ features/<feature>/
│  ├─ api.ts                 # queries/mutations TanStack Query (query keys por feature)
│  ├─ components/            # componentes da feature
│  └─ pages/                 # telas (lazy)
└─ styles/globals.css        # tokens do design (vidro, destaque, aurora, tons, dark)
```

- **Dados**: TanStack Query (cache, invalidação por chave da feature).
  Filtros e paginação na URL (`useSearchParams`) — links compartilháveis.
- **Forms**: React Hook Form + `zodResolver` com os schemas do contracts.
  Erro `VALIDATION_ERROR` da API mapeado para os campos.
- **Auth**: access token **só em memória**; ao abrir, `POST /auth/refresh`
  restaura a sessão pelo cookie. 401 → um refresh único compartilhado →
  repete a chamada; falhou → login com `?next=`.
- **Permissões**: menu e botões filtrados por permissão (`<Can permission>`);
  a API é quem garante.

### Design (mesma linguagem do copiloto-arp)

Fonte Geist. Fundo `fundo-app` com **aurora** verde animada; superfícies de
**vidro** (`.vidro`), cartão de **destaque** escuro com brilho verde, tons
`tom-escuro`/`tom-verde` que redefinem a escala de cinzas por dentro, modo
escuro por `data-theme="dark"` invertendo os neutros. Raios grandes
(`rounded-[1.75rem]`/`2rem`), botões e abas em pílula (ativo `bg-neutral-900
text-white`), títulos `text-4xl md:text-5xl font-semibold tracking-tight`.
Verde da marca `#58c069` / escuro `#2f7d3d`. Sidebar flutuante de vidro com
seções recolhíveis; barra superior com "Seção / Tela", data e busca de telas
(Ctrl+K). Login: formulário à esquerda, foto do Espaço ARP à direita.

---

## 5. Execução

| serviço | imagem | porta interna | porta externa |
|---|---|---|---|
| web | nginx (build do Vite) | 80 | **8082** |
| api | node:22-alpine | 3000 | **3002** |
| db (só perfil `local`) | postgres:17-alpine | 5432 | 5433 |

Produção: `DATABASE_URL` aponta para o Postgres do Supabase; não há container
de banco. Imagens e arquivos ficam no volume `uploads` da VPS, servidos em
`/uploads/`. Dev offline: `docker compose --profile local up` sobe também um
Postgres local.

O nginx do web serve o SPA e faz proxy de `/api/` (e `/uploads/` no modo
local) para `api:3000` — mesma origem, o cookie de refresh funciona sem CORS.
A API roda as migrations ao subir e, com `SEED_ON_START=true`, popula os dados
de demonstração (os mesmos do protótipo do app) e o admin inicial.

Escala horizontal: a API é stateless (JWT, sessões no banco, imagens no
Storage); jobs usam advisory lock do Postgres para rodar em uma réplica só.
Rate limit e cache são em memória por instância atrás de portas — dá para
trocar por um store distribuído sem tocar nos casos de uso.

Admin inicial (seed): `admin@arp.com.br` / senha em `SEED_ADMIN_PASSWORD`.
Lojista de demonstração (seed com dados de demo, app do lojista):
`casabrava@arp.com.br` / mesma senha — cargo Lojista (`coupons.redeem`), loja
Casa Brava.
