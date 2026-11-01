# @arp/web — painel de gestão do app ARP

React 19 + Vite 8 + Tailwind 4 + TanStack Query 5 + React Hook Form/Zod 4.
Fala só com a API em `/api/v1` (proxy do Vite em dev, nginx em produção).
Visual: o mesmo do copiloto-arp (vidro, aurora, tons, dark mode por `data-theme`).

```bash
npm run dev -w @arp/web        # http://localhost:5173 (proxy → VITE_API_PROXY_TARGET, padrão :3000)
npm run build -w @arp/web      # tsc + vite build (um chunk por tela)
npx biome check apps/web       # lint + formatação (use --write)
npx tsx --tsconfig apps/web/scripts/tsconfig.json apps/web/scripts/smoke.ts   # smoke de integração
```

## Estrutura

```
src/
├─ main.tsx                 # fonte Geist, globals.css, Zod em pt-BR, providers, router
├─ styles/globals.css       # tokens: vidro, fume, destaque, ladrilho, flutua, tom-escuro/verde,
│                           # tom-app-* (tons do app), carregando, estoque-*, --serie-1..5, --mapa-*
├─ app/                     # só aqui se monta o app (features não importam de app/)
│  ├─ providers.tsx         # Theme → QueryClient → Auth (+ Toaster, devtools em dev)
│  ├─ query-client.ts       # staleTime 30 s, sem retry em 4xx/BAD_RESPONSE
│  ├─ router.tsx            # todas as telas com `lazy`, guardas por permissão
│  ├─ prefetch.ts           # prefetchRoute(to): baixa o chunk da tela no hover/foco do menu
│  ├─ guards.tsx            # RequireAuth (mustChangePassword → /trocar-senha), GuestOnly,
│  │                        # RequirePermission, HomeRedirect
│  ├─ navigation.ts         # menu tipado (seção → itens com permissão de ROUTES); menu do lojista
│  ├─ layout/               # AppShell, SidebarNav, TopBar (Seção / Tela, data, Ctrl+K), UserPanel
│  └─ pages/                # 403, 404, erro de rota, splash
├─ shared/                  # nada aqui importa de features/ ou app/
│  ├─ api/                  # http.ts, session.ts, errors.ts, form-errors.ts, cache.ts
│  ├─ auth/                 # AuthProvider, useAuth(), useCurrentUser(), usePermission()
│  ├─ config/paths.ts       # PATHS: TODAS as URLs do painel (pt-BR). Nunca string solta.
│  ├─ hooks/                # useUrlState, useSearchParamOption, useSearchText, useDebouncedValue,
│  │                        # useUnsavedChangesGuard, useDocumentTitle, useCopyToClipboard, useNow
│  ├─ lib/dates.ts          # fuso de SP: toZonedInput/fromZonedInput, todayIso, mês, dia da semana
│  ├─ lib/                  # cn, format (pt-BR, fuso São Paulo), icons (lucide curado), text,
│  │                        # forms (pickDirty, saveInput)
│  ├─ theme/                # useTheme/setTheme (chave "tema" no localStorage, igual ao copiloto)
│  └─ ui/                   # design system (index.ts) + ui/charts (gráficos; o de linhas por caminho)
└─ ../scripts/smoke.ts      # smoke de integração (usa os xxxApi e os montadores dos forms)
└─ features/<feature>/
   ├─ api.ts                # xxxApi (chamadas) + query keys + hooks useXxx/useSaveXxx (cache aqui)
   ├─ index.ts              # API PÚBLICA: o que outras features podem importar
   ├─ components/
   └─ pages/                # telas (export nomeado; o router faz o lazy)
```

Features: `auth`, `dashboard`, `stores`, `map`, `catalog`, `users`, `roles`, `audit`,
`settings` (parte 1) e `coupons`, `claims`, `campaigns`, `challenges`, `seals`, `events`,
`highlights`, `notifications`, `visitors` (parte 2). Cada uma tem `api.ts` com a fábrica de
query keys e todos os hooks de dados; as telas só consomem esses hooks.

## Telas da parte 2

| Tela | URLs | O que tem |
|---|---|---|
| Promoções | `/cupons`, `/cupons/nova`, `/cupons/:id`, `/cupons/:id/editar` | Cartões no visual do app (tom, destaque, "restam N", canhoto com foto/ícone e prazo) ou tabela; busca e filtros (loja, situação, tipo) na URL; ativar/pausar/retomar/encerrar com confirmação. Formulário com prévia ao vivo do cartão num celular; prazo padrão das configurações (`settings.manage`) ou 24 h; datas no fuso de SP; economia em R$ → centavos; lojista tem a loja fixa. Detalhe: grade de estoque (usados / aguardando / voltaram / livres), regras e cupons pegos paginados (`?page=`). |
| Validar cupom | `/cupons/validar` | Balcão: "ARP-" já escrito, colar funciona, consulta automática com 6 caracteres, ticket com contagem regressiva, botão Validar grande; um aviso grande por desfecho (validado, já usado, vencido, cancelado, outra loja, não encontrado); foco volta ao campo; últimos validados na sessão. Serve ao lojista. |
| Cupons pegos | `/cupons/pegos` | Tabela paginada com busca e filtros (promoção, loja, situação, visitante como chip removível) na URL. `PATHS.claimsWith({...})` monta o link já filtrado. |
| Campanhas | `/campanhas`, `/campanhas/nova`, `/campanhas/:id?aba=resumo\|faixas\|dados` | Fase + situação, barra do período; resumo (participantes, selos dados, quem alcançou cada faixa); editor de faixas (substitui todas via `replaceTiers`) com prévia do cartão de progresso do app. |
| Desafios | `/desafios?campaignId=`, `/desafios/novo?campaignId=`, `/desafios/:id` | Lista por campanha no visual do app; formulário (selo, QR/automático, loja/evento opcionais, ordem, situação). QR Codes: gerar, janela de validade, revogar/reativar, leituras (dado/repetido/vencido), imprimir cartaz A4 ou folha de etiquetas (`qrcode.react` + `<PrintArea>`) e baixar PNG. |
| Selos | `/selos`, `/selos?aba=conquistados&campaignId=&challengeId=&visitorId=` | Coleção com o badge do app (`SealBadge`), criar/editar com prévia e degradês prontos, arquivar; selos conquistados paginados. |
| Eventos | `/eventos?aba=lista\|calendario\|categorias`, `/eventos/novo`, `/eventos/:id` | Lista com filtros; calendário do mês (`mes=AAAA-MM`; evento longo em faixa com a barra do mês, demais por dia; lista no celular); CRUD de categorias. Formulário com recorrência (um dia / período / toda semana) mostrando só os campos dela, resumo em texto ("Todo sábado · 9h às 14h") e prévia; publicar, cancelar, apagar rascunho. |
| Destaques | `/destaques`, `/destaques/novo`, `/destaques/:id` | Carrossel ordenável (arrastar, teclado na alça: Espaço pega, setas movem, Espaço solta, Esc cancela; ou subir/descer), salva via `reorder`; filtros de fase/situação (com filtro a ordem trava); impressões, cliques e CTR. Formulário com destino (evento/cupom/loja com busca, link, nenhum), patrocinador, período e prévia no `PhoneFrame` como na home do app. |
| Notificações | `/notificacoes`, `/notificacoes/nova`, `/notificacoes/:id` | Lista por situação; rascunho com prévia de push (iPhone/Android na tela bloqueada), público (todos / aceitam ofertas / seguidores de uma loja) com estimativa; enviar agora ou agendar com confirmação; cancelar agendada. Fora de rascunho, só leitura. |
| Visitantes | `/visitantes`, `/visitantes/:id` | Busca e filtros (situação, opt-in); perfil, economia, selos, cupons recentes, favoritas, lojas seguidas, interesses; bloquear (motivo obrigatório) e desbloquear com confirmação. |

Detalhes por id: `useHighlight` e `useNotification` leem `GET /highlights/:id` e
`GET /notifications/:id` (abrem na hora com o item das listas em cache como
`placeholderData`). Lacunas do contrato tratadas no cliente: não há DELETE de selo (só
arquivar); `occurrences` não traz foto/local do evento.

## Convenções

**Contrato primeiro.** Tipos, schemas, rotas e permissões vêm de `@arp/contracts`.
Nunca redeclare DTO. Forms usam o schema do contrato (ou `.pick/.omit` dele).

**Chamadas à API** (`@/shared/api`):

```ts
apiRequest(ROUTES.stores.get, storeDetailSchema, { params: { id }, query, signal }) // valida a resposta
apiCall(ROUTES.stores.remove, { params: { id } })                                  // só para respostas 204
uploadImage(file)                                                                   // POST /uploads (multipart "file")
```

- Bearer em memória, `credentials: "include"`, 401 → **um** refresh compartilhado (Web Lock
  entre abas) → repete; falhou → sessão expirada → login com `?next=` e aviso.
- Resposta fora do schema vira `ApiError("BAD_RESPONSE")` (aparece cedo, sem quebrar a tela).
- `ApiError`: `status`, `code` (`ErrorCode` do contrato + `NETWORK_ERROR`/`BAD_RESPONSE`),
  `message` (pt-BR da API), `fieldErrors`. Use `errorMessage(e)` para texto.

**Respostas das escritas** (convenção do topo de `routes.ts`): criação → 201 com o DTO
completo; PATCH/PUT e ações (status, schedule, cancel, redeem) → 200 com o DTO; DELETE,
reorder, logout e change-password → 204. Toda escrita com corpo usa `apiRequest` com o schema
do DTO; só as 204 usam `apiCall`.

**Chamadas por feature**: cada `api.ts` começa com um objeto `xxxApi` de funções puras
(`storesApi.update(id, body)`, `storesApi.setLocation(id, body)`…). Os hooks só as embrulham.

**Query keys por feature** (fábrica), ex.:

```ts
export const storeKeys = {
  all: ["stores"] as const,
  list: (q: Partial<ListStoresQuery>) => [...storeKeys.all, "list", q] as const,
  detail: (id: string) => [...storeKeys.all, "detail", id] as const,
};
```

Cache depois de escrever: o DTO devolvido vai direto para o detalhe (`setQueryData`) e para
o item das listas em cache (`updateListItem` de `@/shared/api`) — sem refetch do detalhe; as
**listas** (ordem, filtros, contagens) e o que mais depender são invalidados (ex.: categorias
invalidam `storeKeys.all`). Edições pequenas e arrastar no mapa são otimistas (`onMutate` +
`snapshotQueries` para desfazer). Listas paginadas usam `placeholderData: keepPreviousData`;
`select` deriva dados (funções fora do componente, para o resultado ser estável); toda query
repassa o `signal` (busca com espera cancela a anterior sozinha).

`staleTime` por tipo de dado: padrão 30 s (listas e detalhes); cadastros que mudam pouco
(andares, blocos, categorias, cargos, configurações, select de lojas) 5 min; métricas, pontos
do mapa, selos e estimativa de público 1 min; dashboard 1 min com atualização automática;
consulta de código no caixa sem cache.

**Filtros e paginação na URL**: `useUrlState(listXxxQuerySchema)` → `[query, setQuery]`
(mudar filtro volta à página 1; valor inválido na URL é ignorado). Busca com espera:
`useSearchText(query.q, commit)`. Abas: `useSearchParamOption("aba", OPCOES, padrao)`.

**Formulários**: `useForm<z.input<S>, unknown, z.output<S>>({ resolver: zodResolver(S) })`.
- Erro da API por campo: `applyApiErrors(e, form.setError, CAMPOS)`; se devolver `false`,
  `toast.error(errorMessage(e))`.
- Editar: `values` (memo) + `resetOptions: { keepDirtyValues: true }`; PATCH **só com o que
  mudou**: `pickDirty(values, formState.dirtyFields)` (o contrato usa `patchOf`, sem defaults,
  então campo ausente = não mexe); depois `form.reset(values)`. Modais de criar/editar o mesmo
  cadastro mandam `saveInput(id, values, dirtyFields)` (`{ body }` ou `{ id, body }`).
- Montadores de corpo ficam fora do componente (`lib/form.ts`, `coupon-form-schema.ts`:
  `toCreateBody`, `eventPatch`, `cleanHighlight`, `notificationPatch`…).
- Mensagens do Zod em pt-BR (`z.config(ptBR())` em `main.tsx`, igual à API); mensagens
  próprias só quando dizem algo melhor que a genérica.
- Texto opcional que o contrato quer `null`: `register("campo", { setValueAs: emptyToNull })`.
- `<SaveBar>` (barra fumê que gruda no pé) + `useUnsavedChangesGuard(isDirty)`; antes de
  navegar depois de salvar, chame `allowLeave()`.
- Ações destrutivas: `<ConfirmDialog loading error>` (o erro aparece no próprio modal).

**Permissões**: rota → `guarded("x.view", [...])` no router; menu → `permission` do item
(sempre `ROUTES.<rota>.permission`); botões → `<Can permission="x.manage">` ou
`useAuth().can(...)`. O pino da loja no mapa é `map.manage` (não `stores.manage`). Lojista (`user.store != null`) tem menu próprio em `navigation.ts`;
a API força o escopo da loja. Cor nunca sozinha: `StatusBadge` sempre tem ícone + texto.

**Features se falam só pelo `index.ts`** (ex.: `import { useFloors, MapCanvas } from "@/features/map"`).

## Desempenho

- **Carga inicial** (login e moldura): `index` + `react` + `zod` (valida a sessão) + `query` +
  `vendor` (clsx/tailwind-merge). Tudo o mais vem com a tela: `forms` (react-hook-form),
  `icons` (o mapa curado de `lib/icons.ts`), `charts` (recharts, só no dashboard e já
  separado do resto da tela), `qrcode.react` (só no desafio).
- `package.json` declara `"sideEffects": ["*.css"]`: importar do barril `@/shared/ui` só leva o
  que a tela usa. Por isso módulos de `shared/` não executam nada no topo além de declarar.
- Ícones por nome: `IconTile`/`SealIcon` (`ui/IconTile.tsx`) e `iconFor` puxam o mapa curado;
  componentes da moldura importam ícones do lucide **por nome** (nunca o barril inteiro nem
  `DynamicIcon`). A grade do `IconPicker` e os nomes em português (`lib/icon-keywords.ts`)
  carregam só quando o modal abre.
- Prefetch: passar o mouse/focar um item do menu (ou destacar na busca Ctrl+K) baixa o chunk
  da tela (`app/prefetch.ts`; respeita "economia de dados").
- Mapa: o arraste roda num `requestAnimationFrame` por quadro numa prévia fora do estado do
  React (`useDragPreview`): só o desenho renderiza enquanto arrasta; a página e os painéis
  só quando solta (aí salva). Os pinos vêm de `GET /floors/:id/pins` (`useFloorPins`: todas
  as lojas do andar numa chamada, sem o teto de 100 da listagem); mover usa
  `PUT /stores/:id/location` (`map.manage`, `useSetStoreLocation`, otimista nos pinos).
- Imagens: `loading="lazy"` + `decoding="async"` fora da primeira dobra; logos com
  `width`/`height`. Fonte Geist com `font-display: swap` e subconjuntos por `unicode-range`.

## Design system (`@/shared/ui`)

| Componente | Props principais |
|---|---|
| `Card`, `CardHeader` | `variant: glass \| dark \| green \| dashed`, `padding`, `hover`; header: `title, description, icon, action` |
| `Button`, `ButtonLink`, `IconButton` | `variant: primary \| secondary \| ghost \| danger \| brand`, `size`, `icon`, `loading`; IconButton exige `label` |
| `Field` + `Input`/`Select`/`Textarea`/`PasswordInput`/`ColorInput`/`IconPicker` | Field: `label, hint, error, required, optional, action`; o controle herda id/aria pelo contexto |
| `Switch`, `Checkbox` | `checked, onCheckedChange, label, description` |
| `IconPicker` | `value` (kebab-case do lucide), `onChange`, `color` (prévia); lista em `lib/icons.ts` |
| `ImageUpload` | `value, onChange(url \| null), label, aspect: cover \| square` (valida tipo/tamanho do contrato) |
| `Modal`, `ConfirmDialog` | `<dialog>` nativo; `open, onClose, title, description, footer, size, busy`; confirm: `danger, loading, error` |
| `Table<T>` | `columns: {key, header, cell, numeric?, className?}[]`, `rows, rowKey, caption, loading, empty, maxHeight` |
| `Pagination` | `meta` (PageMeta do contrato), `onPageChange` |
| `Tabs` + `TabPanel`, `Segmented`, `NavTabs` | pílula; Tabs (role tablist, setas), Segmented (rádios nativos), NavTabs (links) |
| `StatusBadge`, `CountPill` | `tone: success \| danger \| warning \| neutral \| info \| brand \| dark`, `icon?` |
| `PageHeader` | `title, description, actions, back` (também define o título da aba) |
| `EmptyState`, `ErrorState` | `icon, title, description, action, compact`; ErrorState: `error, onRetry` |
| `LoadError` | detalhe que não carregou: 404 vira "não encontrado" com `back: { to, label }`; outro erro, `ErrorState` |
| `Skeleton`, `SkeletonGrid`, `LoadingRegion`, `PageSkeleton` | blocos `.carregando` no formato da tela |
| `KpiCard` | `label, value, delta (formatDelta), goodWhen, hint, icon, tone: glass \| dark \| green` |
| `SaveBar`, `FormSection`, `FieldRow`, `FormError` | layout de formulário do copiloto |
| `IconTile`, `SealIcon` | ícone pelo nome do banco sobre a cor/degradê (puxam o mapa curado de ícones) |
| `Avatar`, `CopyButton`, `InfoItem`, `FilterBar`, `Can`, `ComingSoon` | utilitários |
| `DateTimeInput` | `value` ISO (UTC) ↔ campo na hora de Brasília; `onChange(iso \| null)`, `min` |
| `TonePicker` | tons do app (`toneSchema`) em rádios com amostra e nome |
| `PhaseBadge` | `phase` (em breve / no ar / encerrada) |
| `PhoneFrame` | moldura de celular para prévias (`screen: light \| dark`, `wallpaper`) |
| `PrintArea` | conteúdo que só sai na impressão (`.area-impressao` em globals.css) |
| `toast.success/error/info/fromError` | avisos no canto (um `<Toaster>` nos providers) |
| `@/shared/ui/charts`: `HourBars`, `BarList`, `ProportionBar`, `ChartLegend` (sem lib); `@/shared/ui/charts/LineSeriesChart` (recharts, importe pelo caminho) | séries `--serie-1..5` presas à métrica; legenda + "Ver em tabela" |

Formatadores (`@/shared/lib/format`): `formatCents`, `formatNumber`, `formatPercent`,
`formatDate/DateTime/Time/DateShort`, `formatIsoDay`, `formatRelative` ("há 3 min"),
`formatDelta`, `plural`, `initials`, `formatCountdown` ("HH:MM:SS"), `formatTimeOfDay`
("9h", "14h30"), `formatHours`. Sempre no fuso `America/Sao_Paulo`. Campos de data e hora
usam `DateTimeInput` (nunca o fuso do navegador); contagens regressivas usam `useNow()`
(um relógio só para a tela).

Tons do app do visitante (cupons/eventos sem foto): classes `tom-app-green|ink|clay|sand|deep`
(mesmos nomes de `toneSchema`). Estoque em quadradinhos: `estoque-usado|aguardando|voltou|livre`.
