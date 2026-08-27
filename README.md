# Finanças Pessoais

Sistema de controle financeiro pessoal com dashboard inteligente, metas de investimento, planejamento orçamentário, importação de extratos e categorização automática.

## Tecnologias

### Backend
- **Node.js** + **Express** — servidor HTTP
- **Prisma ORM** + **PostgreSQL 16** — banco de dados relacional
- **JWT** (`jsonwebtoken` + `bcryptjs`) — autenticação e hash de senhas
- **Multer** — upload de arquivos de extrato
- **pdf-parse** + **xlsx** — leitura de extratos em PDF e Excel

### Frontend
- **React 18** + **Vite** — interface e bundler
- **React Router v6** — navegação SPA com rotas protegidas
- **Tailwind CSS** — estilização
- **Recharts** — gráficos (planejamento)
- **date-fns** — formatação de datas
- **lucide-react** — ícones

## Pré-requisitos

- Node.js 18+
- PostgreSQL 16 (`C:\Program Files\PostgreSQL\16`)
- npm ou yarn

## Instalação

### Opção A — Docker (recomendado)

Sobe o Postgres e a API juntos, sem instalar Postgres na máquina.

```bash
# 1. Defina uma senha local para o banco (NÃO commitar este arquivo)
cp .env.docker.example .env.docker
# edite .env.docker e preencha POSTGRES_PASSWORD com uma senha forte

# 2. Configure o backend
cd backend
cp .env.example .env
# edite backend/.env e ajuste DATABASE_URL para usar a senha definida em .env.docker
#   DATABASE_URL="postgresql://postgres:SUA_SENHA_AQUI@localhost:5432/financas_db"
cd ..

# 3. Suba os containers
docker compose up -d

# 4. Aplique o schema e popule os planos
docker compose exec api npm run db:generate
docker compose exec api npm run db:push
docker compose exec api npm run db:seed
```

A API fica em `http://localhost:3001`.

### Opção B — Postgres local sem Docker

```bash
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE financas_db;"
```

Depois siga para a seção **Backend** abaixo.

### Backend

```bash
cd backend
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Ajuste DATABASE_URL e JWT_SECRET antes de subir.

# Gerar o Prisma Client e aplicar o schema
npm run db:generate
npm run db:push

# Popular planos de assinatura
npm run db:seed

# Iniciar servidor (http://localhost:3001)
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

## Uso

1. Acesse `http://localhost:5173`
2. Crie uma conta em `/cadastro`
3. Adicione suas contas bancárias (Contas)
4. Importe um extrato PDF/Excel ou adicione transações manualmente
5. Configure regras de categorização automática para não precisar categorizar cada lançamento
6. Crie metas financeiras (Carro, Casa, Viagem…) e acompanhe o progresso mensal
7. Use o Planejamento para projetar receitas e despesas fixas dos próximos meses

## Funcionalidades

| Módulo | Descrição |
|---|---|
| **Dashboard** | Visão geral do mês: saldo, taxa de poupança, metas em destaque, gastos por categoria e transações recentes |
| **Autenticação** | Registro, login com JWT, edição de perfil e troca de senha |
| **Transações** | CRUD completo com filtros por tipo, categoria, conta e período |
| **Categorias** | Categorias pré-definidas + personalizadas com cores e ícones |
| **Contas** | Múltiplas contas (corrente, poupança, cartão, dinheiro) com saldo |
| **Metas** | Projete aportes mensais com juros compostos e acompanhe parcelas pagas/pendentes |
| **Planejamento** | Simule receitas e despesas fixas e visualize a projeção de saldo futuro |
| **Importação** | Upload de extratos em PDF e Excel com detecção automática de banco |
| **Regras automáticas** | Crie regras por descrição do lançamento para categorizar importações automaticamente |
| **Assinaturas** | Planos Gratuito / Pro / Premium com limites de transações e contas |
| **Tema** | Modo claro e escuro |
| **Responsivo** | Interface adaptada para mobile e desktop |

## Estrutura do Projeto

```
financas-app/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── jwt.js              # Configuração JWT
│   │   ├── controllers/            # Lógica de negócio de cada rota
│   │   │   ├── auth.js
│   │   │   ├── transactions.js
│   │   │   ├── categories.js
│   │   │   ├── accounts.js
│   │   │   ├── dashboard.js
│   │   │   ├── goals.js
│   │   │   ├── planning.js
│   │   │   ├── imports.js
│   │   │   ├── importBatches.js
│   │   │   ├── merchantRules.js
│   │   │   ├── maintenance.js
│   │   │   └── subscriptions.js
│   │   ├── lib/
│   │   │   └── prisma.js           # Singleton do PrismaClient + patch Decimal→number
│   │   ├── middleware/
│   │   │   └── auth.js             # authMiddleware, requirePlan
│   │   ├── routes/                 # Definição das rotas Express
│   │   ├── utils/
│   │   │   └── password.js         # Hash e verificação de senha
│   │   └── index.js                # Entrypoint do servidor
│   ├── prisma/
│   │   ├── schema.prisma           # Modelos do banco de dados (PostgreSQL)
│   │   └── seed.js                 # Planos de assinatura padrão
│   ├── .env.example                # Variáveis de ambiente necessárias
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx          # Shell da aplicação com navegação
│   │   │   └── ProtectedRoute.jsx  # Guard de rotas autenticadas
│   │   ├── context/
│   │   │   └── AuthContext.jsx     # Estado global de autenticação
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Transactions.jsx
│   │   │   ├── Categories.jsx
│   │   │   ├── Accounts.jsx
│   │   │   ├── Goals.jsx
│   │   │   ├── Planning.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Profile.jsx
│   │   │   └── Subscription.jsx
│   │   ├── services/
│   │   │   └── api.js              # Cliente HTTP para todas as rotas
│   │   └── App.jsx                 # Roteamento SPA
│   └── package.json
└── README.md
```

## Banco de Dados — Design

O schema PostgreSQL usa tipos nativos para precisão e performance:

| Tipo de dado | Coluna Prisma | Tipo PostgreSQL | Motivo |
|---|---|---|---|
| Valores monetários | `Decimal` | `NUMERIC(14, 2)` | Precisão exata — evita erros de float em dinheiro |
| Taxas/juros (%) | `Decimal` | `NUMERIC(8, 4)` | 4 casas decimais para percentuais |
| IDs e FKs | `String @db.Uuid` | `UUID` | Tipo nativo, mais eficiente que VARCHAR |
| Datas | `DateTime @db.Timestamptz` | `TIMESTAMPTZ` | Timezone-aware |
| Texto livre | `String @db.Text` | `TEXT` | Sem limite de tamanho |
| Strings curtas | `String @db.VarChar(N)` | `VARCHAR(N)` | Constraint explícita no banco |

## Autenticação

Todas as rotas marcadas como **protegidas** exigem o header:

```
Authorization: Bearer <token>
```

O token é obtido em `POST /api/auth/login` e expira em 7 dias (configurável via `JWT_EXPIRES_IN` no `.env`).

## API Endpoints

### Health Check
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/health` | Não | Status do servidor |

### Autenticação
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/auth/register` | Não | Criar conta |
| POST | `/api/auth/login` | Não | Login (retorna JWT) |
| GET | `/api/auth/me` | Sim | Dados do usuário logado |
| PUT | `/api/auth/profile` | Sim | Atualizar nome/email |
| PUT | `/api/auth/password` | Sim | Trocar senha |

### Transações
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/transactions` | Sim | Listar (suporta filtros via query) |
| GET | `/api/transactions/:id` | Sim | Buscar por ID |
| POST | `/api/transactions` | Sim | Criar transação |
| PUT | `/api/transactions/:id` | Sim | Atualizar transação |
| DELETE | `/api/transactions/:id` | Sim | Remover transação |

### Categorias
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/categories` | Sim | Listar categorias |
| GET | `/api/categories/:id` | Sim | Buscar por ID |
| POST | `/api/categories` | Sim | Criar categoria |
| PUT | `/api/categories/:id` | Sim | Atualizar categoria |
| DELETE | `/api/categories/:id` | Sim | Remover categoria |

### Contas
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/accounts` | Sim | Listar contas |
| GET | `/api/accounts/:id` | Sim | Buscar por ID |
| POST | `/api/accounts` | Sim | Criar conta |
| PUT | `/api/accounts/:id` | Sim | Atualizar conta |
| DELETE | `/api/accounts/:id` | Sim | Remover conta |

### Dashboard
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/dashboard/summary` | Sim | Resumo do mês (saldo, receitas, despesas, categorias) |
| GET | `/api/dashboard/monthly?year=YYYY` | Sim | Dados mensais do ano |

### Metas
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/goals` | Sim | Listar metas com cronograma de parcelas |
| POST | `/api/goals` | Sim | Criar meta (gera parcelas automaticamente) |
| PATCH | `/api/goals/installments/:id` | Sim | Atualizar status de uma parcela |
| DELETE | `/api/goals/:id` | Sim | Remover meta |

### Planejamento
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/planning` | Sim | Listar itens do planejamento |
| POST | `/api/planning` | Sim | Adicionar item (receita ou despesa fixa) |
| DELETE | `/api/planning/:id` | Sim | Remover item |

### Importação de Extratos
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/import/statement` | Sim | Upload de extrato PDF/Excel via `multipart/form-data` |
| GET | `/api/import/batches` | Sim | Listar lotes de importação |
| DELETE | `/api/import/batches/:id` | Sim | Remover lote e suas transações |

### Regras Automáticas
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/rules/from-transaction/:id` | Sim | Criar regra de categorização a partir de uma transação |

### Manutenção
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/maintenance/purge` | Sim | Remover transações em lote por período ou conta |

### Assinaturas
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/subscriptions/plans` | Não | Listar planos disponíveis |
| GET | `/api/subscriptions` | Sim | Assinatura atual do usuário |
| POST | `/api/subscriptions/subscribe` | Sim | Assinar um plano |
| POST | `/api/subscriptions/cancel` | Sim | Cancelar assinatura |

## Scripts Disponíveis

### Backend
```bash
npm run dev          # Servidor com hot reload (node --watch)
npm run start        # Servidor em produção
npm run db:push      # Aplicar schema ao banco (cria/migra tabelas)
npm run db:generate  # Regenerar o Prisma Client
npm run db:seed      # Popular planos de assinatura
```

### Frontend
```bash
npm run dev      # Servidor de desenvolvimento (Vite)
npm run build    # Build de produção (dist/)
npm run preview  # Preview do build de produção
```
