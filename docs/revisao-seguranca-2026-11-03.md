# Revisão de segurança — 03/11/2026

Escopo: commit `1863c77` do ERP (`apps/api`, `apps/web`, `packages/contracts`,
`supabase/migrations`, Docker) e o cliente do app (`mobile-arp`, Expo) no que toca a
sessão e a API.

Base: os achados da revisão do protótipo Flutter/Go (`ERALDAO/arp-app`,
`docs/code-review-2026-10-22.md`), mais os riscos próprios desta stack (Fastify, JWT +
refresh em cookie, Supabase Storage, painel React).

Revisão só de leitura, sem nada corrigido. Caminhos da API são relativos a
`apps/api/src`. A coluna **Conf.** diz quem conferiu o trecho citado: **sim** = conferido
no código por quem consolidou; **rev.** = evidência do revisor da frente, ainda não
reconferida linha a linha.

## Resumo

- **3 Altas:** código completo de cupom ativo para o lojista (o bug do protótipo de
  volta), não existe exclusão de conta, e o limite das rotas de login troca o limite
  global por IP em vez de somar.
- **8 Médias**, a maioria de configuração (modo dev por omissão, seed de demonstração,
  cookie sem `Secure` no compose, headers perdidos no nginx) e limites de tentativa.
- O núcleo está bem feito: argon2id, JWT com algoritmo e audiência fixos, refresh
  rotativo com detecção de reuso, estoque e caixa travados com `for update`, selos com
  constraint única, SQL sempre parametrizado, upload pelos magic bytes.

## 1. Paridade com a revisão do Flutter

| # Flutter | Ponto | Situação no ERP | Evidência |
| --- | --- | --- | --- |
| 1 | Modo de desenvolvimento fora de produção | **Parcial.** Nenhuma rota devolve código, mas `NODE_ENV` ausente ou vazio vira `development` (ver M1). | `config/env.ts:39` |
| 2 | Excluir conta apaga cupons usados e o histórico do lojista | **N/A hoje: não existe exclusão** (ver A2). As FKs de cupons, selos e leituras de QR não têm `ON DELETE`, então o bug não se repetiria. | `20261101000400_promotions.sql`, `20261101000600_gamification.sql:160` |
| 3 | Código completo de cupom ativo visível para a loja | **Repetido** (ver A1). | `modules/promotions/.../promotions.queries.ts:155` |
| 4 | Tentativas de código passam do limite em paralelo | **OK.** Tentativa reservada com `select … for update` na transação; uso único. Mas há reemissão ilimitada de código (ver M5). | `pg-credentials-repositories.ts:83`, `reset-password.use-case.ts:59-64` |
| 5 | IP errado atrás de proxy | **OK.** `trustProxy` padrão `false`, compose usa `1`, nginx repassa `$proxy_add_x_forwarded_for`. Atenção a um balanceador antes do nginx e à contagem por réplica (`RATE_LIMIT_STORE=memory`). | `env.ts:17-28`, `docker-compose.yml:21`, `nginx.conf.template:61` |
| 6 | Sessões do app nunca expiram | **OK.** Refresh expira após 90 dias sem uso. Sem prazo absoluto (decisão). | `session-service.ts:132-134`, `env.ts:55` |
| 7 | 401 atrasado de token antigo desloga sessão nova | **OK** no app (single-flight + geração; só limpa se o *refresh* falha) e no painel (single-flight com Web Lock). | app `core/auth/token-keeper.ts:107-135`, web `shared/api/session.ts:92-103` |
| 8 | Cupom validável com a promoção desativada | **Decisão.** Continua aceito até `expires_at`, que não é limitado por `ends_at`. | `coupon.ts:91-92`, `claim.ts:51-63` |
| — | Estoque sob concorrência | **OK.** `for update` no cupom; retry barrado por índice único parcial (409). | `pg-promotions-repositories.ts:73`, `claim-coupon.use-case.ts:31-38` |
| — | Validação dupla no caixa | **OK.** `for update of cl` + `Claim.redeem` recusa resgatado, cancelado e vencido. | `pg-promotions-repositories.ts:157`, `claim.ts:58-63` |
| — | Isolamento do lojista | **OK** para o cargo Lojista (escopo no SQL). Latente em agenda, marketing e gamificação (ver M8). | `store-scope.ts:9-14`, `promotions.queries.ts:180,222` |
| — | CSRF e XSS no painel | **OK.** Cookie `sameSite: strict` + CORS com lista fixa; sem `dangerouslySetInnerHTML`; `?next=` saneado. Headers do nginx perdidos (ver M4). | `auth.routes.ts:38-51`, `app.ts:194-201`, web `shared/lib/text.ts:22-27` |
| — | Upload de mídia | **OK.** Magic bytes conferidos, só JPEG/PNG/WebP, nome UUID, sem path traversal. Original mantém EXIF (ver B7). | `upload.ts:69-87`, `local-disk-storage.ts:88-95` |
| — | Audiência do id_token Google/Apple | **OK.** `aud`, `iss`, RS256, `exp`, `email_verified`; e-mail já cadastrado dá 409 (sem vínculo automático). `nonce` opcional (ver B9). | `jose-social-identity-verifier.ts:48-67`, `social-login.use-case.ts:182-183` |
| — | Datas no fuso de São Paulo | **OK.** `timestamptz` com offset obrigatório; dashboard em `America/Sao_Paulo`. Fim de campanha às 23:59 (ver B3). | contracts `common.ts:10`, `dashboard.queries.ts:18-20` |

## 2. Achados

### Altas

| # | Área | Achado | Cenário | Evidência | Correção sugerida | Conf. |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Cupons / lojista | `GET /coupon-claims` devolve o código completo de cupons **ativos**, e o cargo Lojista tem `coupons.view` + `coupons.redeem`. A máscara (`maskClaimCode`) só é usada nos "últimos usos" do app. | O lojista lista os cupons ativos da loja e valida todos sem o cliente presente. | `promotions.queries.ts:136-155`, `promotions.routes.ts:128-135`, `seed/catalog.ts:70-77`, web `ClaimsTable.tsx:79` | Mascarar no servidor o código de cupom ativo nas listagens; completo só no lookup, que exige o código digitado. | sim |
| A2 | Conta do visitante | Não existe exclusão de conta (nem rota, nem caso de uso, nem tela no app). Só bloqueio pelo painel. | Rejeição na App Store (regra 5.1.1(v): conta criada no app precisa poder ser excluída no app) e pedido LGPD sem atendimento. | contracts `app/routes.ts:29-80`, `modules/app-api/application/*` | Caso de uso que anonimiza o visitante (nome, e-mail placeholder único, telefone, hash, `provider_subject`), apaga push tokens e sessões, cancela cupons ativos e preserva usados e selos. | sim |
| A3 | Rate limit | O limite próprio da rota **substitui** o global por IP (comentário do próprio router). Login, cadastro, esqueci, nova senha e social ficam só com a chave IP + e-mail. O comentário de `app-auth.routes.ts` diz o contrário. | Um único IP troca o e-mail a cada tentativa: senha comum contra todos os e-mails, CPU esgotada com argon2, e-mail em massa, e o store em memória (20 mil chaves) descarta os contadores mais antigos. | `shared/infra/http/router.ts:46`, `app-auth.routes.ts:40-44,72-80`, `rate-limit.ts:42-57` | Somar um limite só por IP nessas rotas (outro `groupId` ou hook à parte). Confirmar antes com teste `app.inject` variando o e-mail. | sim (comportamento da lib a confirmar no teste) |

### Médias

| # | Área | Achado | Cenário | Evidência | Correção sugerida | Conf. |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | Env | `NODE_ENV` ausente ou vazio vira `development`: liga Swagger em `/docs`, desliga CSP, cookie sem `Secure` e o mailer de log, que grava o código de nova senha no log. Mitigado pelo Dockerfile e compose, que fixam `production`. | Deploy fora do Docker sem `NODE_ENV`: quem lê o log troca a senha de qualquer visitante. | `config/env.ts:39,184`, `app.ts:188,225-237`, `mail/index.ts:16-19,84` | Default `production` ou exigir `NODE_ENV` explícito; mailer de log só com `development` explícito. | sim |
| M2 | Seed | Dados de demonstração habilitáveis em produção: `.env.example` traz `SEED_ON_START=true` e `SEED_DEMO_DATA=true`; contas do painel nascem com a senha do admin e `must_change_password=false`; visitantes demo com senha padrão pública. | Subir produção copiando o `.env.example`: 4 contas do painel e visitantes com senhas conhecidas. | `.env.example:40-42`, `infra-env.ts:58,62`, `seed/index.ts:95,245-264`, `main.ts:27-40` | Recusar dados de demonstração com `NODE_ENV=production`; sem default para a senha de visitante. | rev. |
| M3 | Cookie | `COOKIE_SECURE` vem `false` por padrão no compose (e no `.env.example`), anulando o default de produção. | Acesso por http (sem HSTS no nginx) expõe o refresh token na rede. | `docker-compose.yml:25`, `.env.example:27` | Default `true` no compose. | sim |
| M4 | nginx | `location /` e `/assets/` têm `add_header` próprio, o que cancela a herança dos headers do `server`: o `index.html` sai sem `X-Frame-Options` e `nosniff`. Não há CSP nem HSTS no nginx. | Clickjacking do painel (inclusive da tela de validar cupom). | `apps/web/nginx.conf.template:42-44,84-93` | Repetir os headers (ou `include`) em cada `location`; CSP com `frame-ancestors 'none'` e HSTS. Conferir com `curl -I` se a borda já acrescenta. | sim |
| M5 | Nova senha | Cada "esqueci" gera código novo com mais 5 tentativas, e o limite é por IP + e-mail. | Com proxies rotativos: ~3.600 ciclos (1 pedido + 5 chutes) por hora, ~35% de acertar o código de 6 dígitos em um dia. | `request-password-reset.use-case.ts:49`, `app-auth.routes.ts:72-80` | Teto por visitante, sem IP, de códigos emitidos (ex.: 5/h) e de erros somados entre códigos. | rev. |
| M6 | Login | Não há limite só por e-mail nem bloqueio progressivo da conta. | Força bruta distribuída numa conta: 1.000 IPs dão ~120 mil tentativas/h. | `visitor-login.use-case.ts`, `app-auth.routes.ts:72-80` | Chave só pelo e-mail com espera progressiva. | rev. |
| M7 | Destaques | `POST /highlights/:id/impression` e `/click` são públicas, sem deduplicação nem limite próprio (só o global de 1.200/min por IP e por réplica). | Script num IP gera ~1,7 milhão de impressões por dia e falseia o relatório do patrocinador. | contracts `app/routes.ts:77-78`, `track-highlight.use-case.ts:21-24` | Limite próprio + deduplicação por (destaque, aparelho ou visitante, janela). | rev. |
| M8 | Escopo de loja | Agenda, marketing (destaques, notificações) e gamificação não aplicam escopo de loja. Latente: o cargo Lojista atual não tem essas permissões. | Admin cria cargo de loja com `events.manage` ou `notifications.manage`: o usuário edita eventos de qualquer loja ou dispara push para seguidores de outra. | ausência de `scopedStoreId`/`assertStoreAccess` em `modules/agenda`, `modules/marketing`, `modules/gamification` | Aplicar `assertStoreAccess` nesses casos de uso, ou impedir essas permissões em usuário com loja. | rev. |

### Baixas

| # | Área | Achado | Evidência | Correção sugerida | Conf. |
| --- | --- | --- | --- | --- | --- |
| B1 | Caixa | Código de outra loja responde 403 "é de outra loja" e inexistente 404: oráculo para confirmar códigos válidos. Os quatro limites das rotas de código são independentes e por réplica. | `errors.ts:48`, `promotions.routes.ts:46-50`, `merchant.routes.ts:50-54` | 404 igual para outra loja e inexistente. | rev. |
| B2 | Estoque | O redeem não trava o cupom: retirada logo após o vencimento pode reusar a unidade que um redeem iniciado antes ainda grava como `redeemed` (estoque +1). | `pg-promotions-repositories.ts:157`, `promotions.queries.ts:67-71` | Travar o cupom no redeem ou comparar `expires_at > now()` no UPDATE. | rev. |
| B3 | Datas | Campanha nova termina em `T23:59` com fim exclusivo: QR lido entre 23:59 e 00:00 do último dia volta "expired". | web `CampaignForm.tsx:39`, `campaign.ts:127-134` | Usar 00:00 do dia seguinte. | rev. |
| B4 | Dados pessoais | O token do lojista abre `GET /coupon-claims` e `/lookup` do painel, que devolvem nome completo e id do visitante (no app o caixa vê só o primeiro nome). | contracts `promotions.ts:146`, `merchant-claims.ts:91` | Só o primeiro nome quando quem pede tem loja. | rev. |
| B5 | Push | `deepLink` de notificação é texto livre (300 caracteres). O app só abre http(s) e rotas de lista fechada, o que atenua. | contracts `marketing.ts:139`, `marketing-deps.ts:84`, app `notifications/links.ts:13-34,74-76` | Aceitar só `arp://` com rotas conhecidas ou https. | rev. |
| B6 | Logs | Código do cupom vai na query string (`?code`) e o log de requisição grava a URL. | contracts `routes.ts:106`, `app/merchant.ts:64` | Código no corpo ou redigir a URL no log. | rev. |
| B7 | Upload | Original gravado sem reprocessar: mantém EXIF/GPS e bytes extras. | `upload-image.use-case.ts:144` | Recodificar o original com sharp, sem metadados. | rev. |
| B8 | Banco | `DB_SSL=auto` (padrão) usa `rejectUnauthorized: false`. | `database.ts:187-196` | `DB_SSL=verify` com o CA do Supabase. | rev. |
| B9 | Login social | `nonce` opcional e gerado pelo app: id_token vazado pode ser reapresentado até vencer. | `jose-social-identity-verifier.ts:63`, contracts `app/auth.ts:50` | Exigir `nonce` na Apple; de preferência nonce de uso único emitido pela API. | rev. |
| B10 | Sessão | Access token vale até 15 min após logout, nova senha ou desativação do usuário do painel (`sid` não conferido). | `shared/infra/http/auth.ts:32-60` | Conferir `sid` em rotas sensíveis ou aceitar a janela. | rev. |
| B11 | App | Perfil (nome, e-mail, telefone) e cache `me` do React Query (com código de cupom) ficam no SQLite sem criptografia; `allowBackup` não definido. | app `core/auth/session.ts:41`, `core/query/query-client.ts:15-16,44` | `android.allowBackup: false` (ou regras de backup) ou aceitar o risco. | rev. |
| B12 | App | Logout: persister grava com 5 s de atraso (cache `me` pode ficar no disco); sessão vencida ou logout offline não desvincula o push no servidor; buscas recentes ficam. | app `query-client.ts:72`, `session.ts:110-120`, `SearchScreen.tsx:77` | `queryPersister.removeClient()` no signOut; desvincular push no próximo login. | rev. |
| B13 | Painel | `sessionStorage` `arp:validados` (código e nome do visitante) não é limpo no logout; logout com falha mantém o cookie de refresh. | web `RecentRedemptions.tsx:11-19`, `AuthProvider.tsx:43,60-64` | Apagar a chave no evento de saída. | rev. |
| B14 | Painel | Falha de rede ou 5xx no refresh manda para o login (disponibilidade). | web `shared/api/session.ts:75-83`, `http.ts:67` | Só tratar como sessão expirada em 401/403 do refresh. | rev. |
| B15 | Painel | `mustChangePassword` não trava nada no servidor. | `merchant-login.use-case.ts:185-187` | Bloquear rotas além de trocar senha enquanto a flag estiver ligada. | rev. |
| B16 | Auditoria | Tentativas de login que falharam não são registradas. | `20261101000900_audit.sql` | Registrar falhas (sem a senha). | rev. |
| B17 | Dependências | `npm audit`: 4 moderadas, todas via `@fastify/swagger-ui`, registrado só fora de produção. | `app.ts:225-237` | Atualizar quando sair versão corrigida. | rev. |

## 3. Verificado sem problemas

- **Senhas:** argon2id (19 MiB, t=2, p=1); hash falso com o mesmo custo para e-mail
  inexistente, conta só social e usuário desativado; mesma mensagem.
- **JWT:** segredo com 32+ caracteres sem default; `HS256` fixo, `aud`, `iss` e claims
  obrigatórios; token do app (`aud app`) não entra no painel (`aud admin`) e vice-versa.
- **Refresh:** 32 bytes aleatórios, só o SHA-256 no banco, rotação com detecção de reuso
  (revoga a família, tolerância de 60 s), logout revoga, nova senha derruba sessões,
  bloqueio pelo painel revoga sessões.
- **RBAC:** as 96 rotas do catálogo passam pelo `createRouter` com `authenticate` e
  `authorize` a partir do contrato; último admin protegido; cargo do sistema imutável.
- **Lojista no app:** token do painel separado do visitante, armazenamento separado no
  celular, validação restrita à própria loja.
- **Respostas:** sem `SELECT *`; toda rota tem schema de resposta Zod.
- **SQL:** a tag `sql` sempre parametriza; LIKE escapado; todo `sql.raw` usa só valores
  do código ou do env.
- **Erros:** 500 genérico, log completo só no servidor.
- **Selos:** só com desafio ativo, campanha publicada e QR na janela; constraint única
  por (visitante, desafio), corrida tratada por savepoint.
- **Código do cupom:** `ARP-` + 6 de 32 símbolos com `crypto.randomInt`, limite de
  120/min por usuário.
- **Segredos:** só `.env.example` versionado, sem valores sensíveis; nenhuma chave do
  Supabase no build do painel; `EXPO_PUBLIC_*` só com URL da API e client IDs públicos.
- **Painel:** access token só em memória.
- **App:** tokens no SecureStore; build fora de dev exige https; sem cleartext
  liberado; deep links e QR por lista fechada.
- **Limites:** corpo de 1 MB (6 MB no nginx), `pageSize` até 100, timeouts de requisição
  e de banco.
- **Auditoria:** só inserção (trigger bloqueia update e delete), sem hash de senha.

## 4. Decisões de produto em aberto

- **"Um por pessoa"** hoje é um cupom *ativo* por pessoa: quem usou ou deixou vencer pega
  de novo. O cadastro não confirma o e-mail, então várias contas por pessoa são triviais.
- **Promoção pausada ou encerrada:** cupons já pegos continuam válidos até o prazo de uso
  (o prazo não é limitado pelo fim da promoção). Definir se o caixa deve recusar.
- **QR fixo por desafio:** uma foto compartilhada vale o selo de qualquer lugar, e o link
  `selo/[token]` resgata ao abrir. Se for problema: QR rotativo ou geolocalização.
- **Recompensa por faixa** é derivada da contagem de selos; não há registro de benefício
  resgatado, então o uso na loja não é controlado pela API.
- **`users.manage` equivale a super-admin** (pode dar a si qualquer cargo ou criar cargo
  com qualquer permissão). Hoje só o Administrador tem.
- **Refresh sem prazo absoluto:** renova a cada uso; token roubado de quem parou de usar
  vive até 90 dias sem uso.
- **Enumeração de e-mail:** o cadastro já responde "E-mail já cadastrado", e o "esqueci"
  demora mais quando a conta existe (espera o SMTP).
- **Lista de visitantes** mostra e-mail e telefone a quem tem `visitors.view` (Marketing
  e Atendimento). Avaliar minimização.

## 5. Fora do código: build de teste aponta para produção

No `mobile-arp`, a mudança não commitada no `eas.json` faz os perfis `preview` e
`production` usarem a mesma API. O build interno "ARP (teste)" passa a gravar dados
reais. Voltar o `preview` para staging ou assumir isso de forma explícita.

## 6. Como a revisão foi feita

Cinco frentes revisadas em paralelo:

1. Auth do app (e-mail/senha, Google/Apple, nova senha por código, refresh, rate limit).
2. Auth do painel, RBAC e isolamento do lojista (IDOR, escopo de loja, dados pessoais).
3. Regras de negócio: cupons, estoque, validação no caixa, selos por QR, exclusão de conta.
4. Plataforma: env e modo dev, CORS, cookies e CSRF, headers, erros, upload, SQL, logs,
   segredos, Docker/nginx, `/docs`, `npm audit`.
5. Clientes: painel React e app Expo (armazenamento de token, 401, XSS, deep links, push).

As Altas e as Médias M1, M3 e M4 foram reconferidas no código. Os testes não foram
rodados (sem `node_modules` instalado). A3 precisa de um teste com `app.inject` para
confirmar o comportamento do `@fastify/rate-limit`.

Ordem sugerida de correção: A1 → A3 → M1/M2/M3 (configuração, rápidas) → A2 (exclusão
de conta, antes de publicar na loja) → M4 → M5/M6 → demais.
