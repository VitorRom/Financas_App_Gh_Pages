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
| **Planejamento** | Receitas e despesas fixas com projeção de saldo futuro |
| **Investimentos** | Carteira com cotações via BrAPI, dividendos, alocação e Tesouro Direto |
| **Metas de investimento** | Projeção de patrimônio com aporte mensal e taxa esperada |
| **Importação** | Upload de extratos PDF/Excel com detecção automática de banco |
| **Regras automáticas** | Categoria automática por descrição do lançamento |
| **Assinaturas** | Planos Free / Pro / Premium com limites de transações e contas |
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

```bash
# Frontend (em outro terminal)
cd frontend
npm install
npm run dev                # http://localhost:5173
```

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
├── components/              # Componentes reutilizáveis
│   └── investments/         # Componentes específicos de investimentos
├── context/                 # AuthContext (estado global de autenticação)
├── services/
│   └── api.js               # Cliente HTTP único (fetch wrapper)
└── App.jsx                  # Roteamento SPA
```

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

---

## API Endpoints

Todas as rotas marcadas como **protegidas** exigem `Authorization: Bearer <token>`.

| Recurso | Endpoints |
|---|---|
| **Health** | `GET /api/health` |
| **Auth** | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` · `PUT /auth/profile` · `PUT /auth/password` |
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

- **Senhas** armazenadas com `bcryptjs` (hash + salt)
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
npm run dev          # Servidor com hot reload (node --watch)
npm run start        # Produção
npm run db:push      # Aplicar schema (cria/migra tabelas)
npm run db:generate  # Regenerar Prisma Client
npm run db:seed      # Popular planos de assinatura
```

### Frontend
```bash
npm run dev      # Servidor de desenvolvimento (Vite)
npm run build    # Build de produção (dist/)
npm run preview  # Preview do build
```

---