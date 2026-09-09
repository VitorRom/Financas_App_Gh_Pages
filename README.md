# Finanças Pessoais

Sistema de controle financeiro pessoal com dashboard, metas de investimento, planejamento orçamentário, importação de extratos, regras de categorização automática e carteira de investimentos.

Stack: Node.js + Express + Prisma + PostgreSQL no backend, React + Vite no frontend.

---

## Funcionalidades

| Módulo | Descrição |
|---|---|
| **Dashboard** | Visão geral do mês: saldo, taxa de poupança, metas em destaque, gastos por categoria e transações recentes |
| **Autenticação** | Registro, login com JWT, edição de perfil e troca de senha |
| **Transações** | CRUD completo com filtros por tipo, categoria, conta e período |
| **Categorias** | Pré-definidas + personalizadas com cores e ícones |
| **Contas** | Múltiplas contas (corrente, poupança, cartão, dinheiro) com saldo |
| **Metas** | Aportes mensais com juros compostos e acompanhamento de parcelas |
| **Planejamento** | Receitas e despesas fixas com mês de início absoluto e projeção de saldo futuro |
| **Investimentos** | Carteira com cotações via BrAPI, dividendos, alocação e Tesouro Direto |
| **Metas de investimento** | Projeção de patrimônio com aporte mensal e taxa esperada |
| **Importação** | Upload de extratos PDF/Excel com detecção automática de banco |
| **Regras automáticas** | Categoria automática por descrição do lançamento |
| **Assinaturas** | Planos Free / Pro / Premium com limites de transações e contas |
| **Primeiro uso** | Apresentação em 7 passos no primeiro acesso + lista de primeiros passos no Dashboard |
| **Tema** | Modo claro e escuro |
| **Responsivo** | Interface adaptada para mobile e desktop |

---

## Tecnologias

### Backend
- **Node.js 18+** + **Express 4** — servidor HTTP
- **Prisma 5** + **PostgreSQL 16** — ORM e banco relacional
- **JWT** (`jsonwebtoken` + `bcryptjs`) — autenticação e hash de senhas
- **Zod** — validação de entrada
- **Multer** — upload de arquivos de extrato
- **pdf-parse** + **xlsx** — leitura de extratos
- **pino** — logging estruturado
- **helmet** + **express-rate-limit** — hardening HTTP

### Frontend
- **React 18** + **Vite 5** — interface e bundler
- **React Router v6** — SPA com rotas protegidas
- **Tailwind CSS** — estilização
- **Recharts** — gráficos
- **date-fns** — datas
- **lucide-react** — ícones

---

## Pré-requisitos

- **Docker** (recomendado) **ou** Node.js 18+ com PostgreSQL 16 local
- npm

---

## Instalação

### Opção A — Docker (recomendado)

Sobe Postgres + API em containers isolados, sem instalar Postgres na máquina.

```bash
# 1. Crie o arquivo de variáveis do Docker (NÃO versionado)
cp .env.docker.example .env.docker
```

Edite `.env.docker` e defina pelo menos:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=uma-senha-forte-aqui
POSTGRES_DB=financas_db
JWT_SECRET=uma-chave-de-pelo-menos-32-caracteres
CORS_ORIGIN=http://localhost:5173
```

Depois:

```bash
# 2. Suba os containers
docker compose up -d

# 3. Aplique o schema e popule os planos de assinatura
docker compose exec api npm run db:generate
docker compose exec api npm run db:push
docker compose exec api npm run db:seed
```

API em `http://localhost:3001` · Postgres em `localhost:5432`.

### Opção B — Postgres local + Node direto

```bash
# Crie o banco (uma vez)
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE financas_db;"
```

```bash
# Backend
cd backend
cp .env.example .env       # ajuste DATABASE_URL e JWT_SECRET
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev                # http://localhost:3001
```

> **Use `npm run dev`, não `npm start`.** Só o `dev` roda com `node --watch`, que
> recarrega a API a cada alteração. Com `npm start` o servidor continua servindo o
> código que estava em memória quando subiu — e o sintoma no frontend é confuso:
> rota nova responde 404, campo novo some da resposta. O servidor avisa no boot
> quando está sem hot reload.

```bash
# Frontend (em outro terminal)
cd frontend
npm install
npm run dev                # http://localhost:5173
```

---

## Publicar

Há dois jeitos de publicar, e eles resolvem problemas diferentes.

### Modo autônomo — hospedagem estática, sem servidor

**É o padrão do workflow.** A aplicação roda inteira no navegador de quem acessa:
sem API, sem banco, sem login. Os dados ficam no `localStorage` do próprio navegador.
Serve para colocar no ar em GitHub Pages sem infraestrutura nenhuma.

O que muda em relação ao modo completo:

| | Modo autônomo | Com API |
|---|---|---|
| Login | não existe, entra direto | e-mail e senha |
| Dados | no navegador de cada pessoa | no Postgres, compartilhados entre aparelhos |
| Importar extrato | indisponível (o parser é do servidor) | PDF e Excel |
| Cotações de mercado | indisponíveis; preço informado à mão | BrAPI e Tesouro Transparente |
| Backup | arquivo JSON no Perfil | banco de dados |

> **Limitação que importa:** limpar os dados do site apaga tudo, e nada sincroniza
> entre celular e notebook. Por isso o Perfil tem **Baixar backup** e **Restaurar
> backup** — oriente quem for usar a baixar o arquivo de vez em quando.

Para publicar assim, basta **Settings → Pages → Source: GitHub Actions**. O push na
`main` já faz o resto.

A implementação vive em `frontend/src/services/standalone/` e é ativada por
`VITE_STANDALONE=true` no build. `services/api.js` desvia todas as chamadas para lá,
mantendo o mesmo contrato — nenhuma tela precisou ser alterada.

Para rodar o modo autônomo localmente:

```bash
cd frontend
VITE_STANDALONE=true npm run dev
```

### Modo completo — com API e banco

Precisa hospedar as duas metades:

| Parte | Onde |
|---|---|
| `frontend/` | GitHub Pages, Netlify, Vercel |
| `backend/` + Postgres | Render, Railway, Fly.io, VPS |

1. Suba `backend/` em um serviço com Node e Postgres, definindo:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=...                            # mínimo 32 caracteres
NODE_ENV=production
CORS_ORIGIN=https://<usuario>.github.io   # sem isso o navegador bloqueia o frontend
```

Depois rode uma vez `npm run db:push` e `npm run db:seed`.

2. Em **Settings → Secrets and variables → Actions → Variables**, crie
   `VITE_API_URL` com a URL pública da API. O workflow detecta e desliga o modo
   autônomo sozinho.

### Detalhes que o Pages exige

- **Subcaminho:** o site fica em `https://<usuario>.github.io/<repositorio>/`, então o
  build usa `VITE_BASE` e o React Router recebe esse valor como `basename`.
- **Rotas diretas:** o Pages não tem fallback de SPA. O build copia `index.html` para
  `404.html`, e abrir `/transactions` direto funciona.
- **Acesso:** qualquer pessoa com o link abre a aplicação. No modo autônomo isso é
  inofensivo — cada navegador tem os próprios dados, e nada é enviado a lugar nenhum.

---

## Configuração das Variáveis de Ambiente

### `backend/.env`

| Variável | Descrição | Padrão |
|---|---|---|
| `DATABASE_URL` | URL de conexão Postgres | `postgresql://postgres:SUA_SENHA@localhost:5432/financas_db` |
| `JWT_SECRET` | Chave de assinatura JWT (**mín. 32 chars**) | — |
| `JWT_EXPIRES_IN` | Tempo de vida do token | `7d` |
| `PORT` | Porta do servidor | `3001` |
| `NODE_ENV` | `development` / `production` / `test` | `development` |
| `CORS_ORIGIN` | Origens permitidas (CSV) | vazio = qualquer (dev) |
| `BRAPI_TOKEN` | Token para cotações (https://brapi.dev) | vazio = sem cotações |
| `ENFORCE_PLAN_LIMITS` | Aplica os limites de transações/contas do plano | `false` |

> **Limites de plano.** Ficam desligados por padrão: o plano gratuito permite 100
> transações e 2 contas, o que travaria o uso pessoal na primeira importação de
> extrato. A checagem existe e está aplicada na criação de contas e transações —
> defina `ENFORCE_PLAN_LIMITS=true` para ligá-la. Note que `POST /subscriptions/subscribe`
> ainda não cobra nada: a troca de plano é livre até existir integração de pagamento.

### `.env.docker` (raiz)

Lido pelo `docker-compose.yml` para os serviços `api` e `db`. Crie a partir de `.env.docker.example`.

---

## Arquitetura

### Backend

Estrutura em **módulos por domínio** (accounts, transactions, goals, etc.), cada um com 5 camadas separadas:

```
backend/src/
├── app.js                   # Configuração do Express
├── server.js                # Entrypoint (carrega env, conecta DB, sobe servidor)
├── modules/                 # Domínios — cada um tem:
│   └── <domínio>/
│       ├── <domínio>.routes.js       # Definição das rotas
│       ├── <domínio>.controller.js   # Handlers HTTP
│       ├── <domínio>.service.js      # Regras de negócio
│       ├── <domínio>.repository.js   # Acesso ao banco (Prisma)
│       └── <domínio>.schema.js       # Validação com Zod
├── shared/                  # Código compartilhado entre módulos
│   ├── config/              # env.js (validação Zod), jwt.js
│   ├── middleware/          # auth, error, validate, rateLimit
│   ├── lib/                 # prisma (singleton)
│   └── utils/               # logger (pino), errors, password
└── services/                # Integrações externas (brapi, tesouroTransparente)
```

**Decisões de design:**

- **Repository pattern** — cada módulo tem um repositório próprio, isolando queries Prisma.
- **Validação na borda** — Zod valida o body antes de chegar no service. O middleware `validate()` substitui `req.body` pelo dado parseado.
- **Erro centralizado** — `AppError` é a única exceção da aplicação; `errorMiddleware` mapeia para HTTP status.
- **Logger estruturado** — pino (JSON em prod, pretty em dev).
- **Auth via JWT** — middleware `authMiddleware` decodifica o token e injeta `req.user`. Rotas públicas (`/auth/*`, `/subscriptions/plans`) ficam antes do middleware.
- **Rate limiting** — `defaultLimiter` global (1000 req / 15 min) + `authLimiter` em `/auth/login` e `/auth/register` (20 req / 15 min).
- **CORS configurável** — em produção, defina `CORS_ORIGIN` com a URL do frontend.

### Frontend

```
frontend/src/
├── pages/                   # Telas (Login, Dashboard, Transactions, ...)
├── components/
│   ├── ui/StateMessage.jsx  # Estados de carregando / erro / vazio
│   ├── onboarding/          # Apresentação de primeiro uso + primeiros passos
│   └── investments/         # Componentes específicos de investimentos
├── context/
│   ├── AuthContext.jsx      # Sessão do usuário
│   ├── ToastContext.jsx     # Avisos (useToast)
│   └── ConfirmContext.jsx   # Diálogo de confirmação (useConfirm)
├── services/
│   └── api.js               # Cliente HTTP único (fetch wrapper)
└── App.jsx                  # Roteamento SPA com code splitting por rota
```

Login e Dashboard entram no bundle inicial; as demais telas são carregadas sob
demanda com `React.lazy`, o que mantém o Recharts fora do primeiro carregamento.

Nenhuma tela usa `alert()` ou `confirm()`: mensagens passam por `useToast()` e
confirmações por `useConfirm()`. Toda chamada de API que falha renderiza um
`ErrorState` com botão de tentar de novo — nunca uma tela em branco.

### Primeiro uso

Duas peças independentes:

- **`WelcomeTour`** — apresentação em 7 passos, exibida uma vez por conta. Cada passo
  desenha a própria ilustração: nenhum aponta para elemento da página nem troca de
  rota, então a navegação entre passos é instantânea e não depende de nada estar
  montado. Fecha com Esc, navega com ← →, e o foco fica preso no diálogo. É carregada
  sob demanda (`React.lazy`), então quem já viu não baixa o código.
- **`FirstStepsCard`** — lista de três passos no topo do Dashboard, com o estado de
  cada um vindo dos dados reais (tem conta? tem transação? tem meta?). Some sozinha
  quando os três estiverem feitos, e pode ser ocultada antes disso.

A conclusão é persistida em `User.onboardingCompletedAt` via
`POST /api/auth/onboarding/complete` — idempotente, preserva a data original. O botão
"Ver apresentação de novo" no Perfil reabre a apresentação sem apagar essa data.

Todas as chamadas HTTP passam por `services/api.js`, que:
- Injeta `Authorization: Bearer <token>` automaticamente
- Detecta 401 em rotas protegidas e dispara logout via evento customizado
- Suporta JSON e `multipart/form-data`

---

## Banco de Dados

Schema PostgreSQL com tipos nativos para precisão monetária:

| Tipo | Mapeamento Prisma → Postgres | Por quê |
|---|---|---|
| Valores monetários | `Decimal` → `NUMERIC(14, 2)` | Precisão exata — evita erro de float |
| Taxas (%) | `Decimal` → `NUMERIC(8, 4)` | 4 casas decimais |
| IDs e FKs | `String @db.Uuid` → `UUID` | Mais eficiente que VARCHAR |
| Datas | `DateTime @db.Timestamptz` → `TIMESTAMPTZ` | Timezone-aware |
| Texto livre | `String @db.Text` → `TEXT` | Sem limite |
| Strings curtas | `String @db.VarChar(N)` → `VARCHAR(N)` | Constraint explícita |

Models principais: `User`, `Subscription`, `Plan`, `Account`, `Category`, `Transaction`, `ImportBatch`, `MerchantRule`, `Goal`, `GoalInstallment`, `PlanningItem`, `Investment`, `InvestmentTransaction`, `InvestmentGoal`, `PriceHistory`, `MarketIndex`.

### Meses no Planejamento

`PlanningItem.startDate` guarda o **mês de início absoluto** (primeiro dia do mês, em
UTC). A janela de atividade de um item é `[startDate, startDate + monthsDuration)`,
comparada em índices absolutos de mês (`ano × 12 + mês`).

Isso substituiu `startMonth`, que era um deslocamento em meses contado a partir da
data corrente: como "hoje" muda, um item marcado para novembro virava dezembro na
virada do mês, e um parcelamento de 9 vezes nunca terminava. A coluna antiga segue
no banco, sem ninguém ler, até o backfill ser conferido — pode ser removida depois.

Para converter itens criados antes da mudança:

```bash
node -r dotenv/config prisma/backfill-planning-start-date.js --dry-run   # confere
node -r dotenv/config prisma/backfill-planning-start-date.js            # aplica
```

Ele reconstrói o mês pretendido a partir de `createdAt + startMonth`.

### Saldo das contas

`Account` guarda dois valores: `initialBalance` (saldo de abertura, informado na
criação) e `balance` (saldo corrente). A identidade é:

```
balance = initialBalance + Σ receitas − Σ despesas
```

Guardar a abertura separada é o que permite recalcular saldos depois de apagar
transações sem perder o valor que o usuário informou. Contas de investimento são a
exceção: o saldo vem das posições dos ativos, e `balance` fica sempre em 0.

Se você já tinha contas antes desse campo existir, rode uma vez após o `db:push`:

```bash
node -r dotenv/config prisma/backfill-initial-balance.js
```

---

## API Endpoints

Todas as rotas marcadas como **protegidas** exigem `Authorization: Bearer <token>`.

| Recurso | Endpoints |
|---|---|
| **Health** | `GET /api/health` |
| **Auth** | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` · `PUT /auth/profile` · `PUT /auth/password` · `POST /auth/onboarding/complete` |
| **Subscriptions** | `GET /subscriptions/plans` · `GET /subscriptions` · `POST /subscriptions/subscribe` · `POST /subscriptions/cancel` |
| **Transactions** | `GET /transactions` · `GET /transactions/:id` · `POST` · `PUT /:id` · `DELETE /:id` |
| **Categories** | `GET /categories` · `POST` · `PUT /:id` · `DELETE /:id` |
| **Accounts** | `GET /accounts` · `POST` · `PUT /:id` · `DELETE /:id` |
| **Dashboard** | `GET /dashboard/summary` · `GET /dashboard/monthly?year=YYYY` |
| **Goals** | `GET /goals` · `POST` · `PATCH /installments/:id` · `DELETE /:id` |
| **Planning** | `GET /planning` · `POST` · `PUT /:id` · `DELETE /:id` |
| **Import** | `POST /import/statement` (multipart) · `GET /import/batches` · `DELETE /import/batches/:id` |
| **Rules** | `POST /rules/from-transaction/:id` |
| **Maintenance** | `POST /maintenance/purge` |
| **Investments** | `GET /investments` · `GET /:id` · `POST` · `PUT /:id` · `DELETE /:id` · `POST /:id/refresh-price` · `GET /summary` · `GET /evolution` · `GET /allocation` · `GET /dividends` |
| **Investment Transactions** | `GET /investments/:id/transactions` · `POST` · `PUT /:id` · `DELETE /:id` |
| **Investment Goals** | `GET /investment-goals` · `POST` · `PUT /:id` · `DELETE /:id` · `GET /:id/projection` |
| **Market** | `GET /market/quote/:ticker` · `POST /market/refresh-all` · `GET /market/indices` · `GET /market/index-history` |

---

## Segurança

- **Senhas** armazenadas com `bcryptjs` (hash + salt), mínimo de 8 caracteres
- **Invalidação de sessão** — `User.tokenVersion` viaja dentro do JWT; trocar a senha
  incrementa o valor e derruba todos os tokens emitidos antes (a sessão que trocou
  recebe um token novo na resposta)
- **Isolamento entre usuários** — todo recurso é buscado por `id + userId` antes de
  ser lido ou escrito, inclusive as contas e categorias referenciadas por uma transação
- **JWT** com `JWT_SECRET` obrigatório (mínimo 32 caracteres, validado por Zod na inicialização)
- **Rate limiting** em todas as rotas, com limite agressivo em login/registro
- **Helmet** para headers HTTP seguros
- **CORS** configurável por env var (em produção, defina origens explícitas)
- **Validação de entrada** com Zod em todas as rotas que recebem body
- **Centralização de erros** — stack traces nunca são expostos ao cliente
- **Não há** hardcoded secrets ou fallbacks inseguros no código

---

## Scripts

### Backend
```bash
npm run dev               # Servidor com hot reload (node --watch)
npm run start             # Produção
npm test                  # Testes unitários (não precisam de banco)
npm run test:integration  # Testes de integração (precisam de DATABASE_URL válido)
npm run db:push           # Aplicar schema (cria/migra tabelas)
npm run db:generate       # Regenerar Prisma Client
npm run db:seed           # Popular planos de assinatura
```

### Frontend
```bash
npm run dev      # Servidor de desenvolvimento (Vite)
npm run build    # Build de produção (dist/)
npm run lint     # ESLint (falha com qualquer aviso)
npm run preview  # Preview do build
```

## Testes

```
backend/tests/
├── unit.test.mjs         # Funções puras: preço médio, rentabilidade, parsers de extrato
├── regression.test.mjs   # Trava bugs já corrigidos (datas de parcelas, menos tipográfico)
└── integration.test.mjs  # Contra Postgres real: isolamento entre usuários, saldos, exclusões
```

Os testes de integração criam usuários próprios com e-mail aleatório e apagam tudo
no final — não tocam em dados existentes.

---