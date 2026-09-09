/**
 * Backend do modo autônomo: implementa o mesmo contrato de `services/api.js`, só que
 * dentro do navegador, sobre o armazenamento local.
 *
 * O único ponto de entrada é `handleStandaloneRequest`. Ele recebe o mesmo par
 * (endpoint, options) que iria para o `fetch` e devolve o que a API devolveria —
 * inclusive lançando erro com a mesma mensagem, para os avisos da interface
 * funcionarem sem alteração.
 */
import { loadDatabase, mutate, uuid, nowIso, fail } from './store.js';
import {
  calculateAveragePrice,
  calculateAverageInterestRate,
  pmtFromFutureValue,
  buildInstallments,
  projectGoal,
  round2,
} from './calculations.js';

/* ------------------------------------------------------------------ helpers */

function parseEndpoint(endpoint) {
  const [path, search = ''] = endpoint.split('?');
  return {
    segments: path.split('/').filter(Boolean),
    query: Object.fromEntries(new URLSearchParams(search)),
  };
}

function body(options) {
  if (!options?.body) return {};
  try {
    return JSON.parse(options.body);
  } catch {
    return {};
  }
}

function findOr404(collection, id, label) {
  const item = collection.find((x) => x.id === id);
  if (!item) throw fail(`${label} não encontrada`, 404);
  return item;
}

/** Transação com categoria e conta embutidas, como a API entrega. */
function withRelations(db, tx) {
  return {
    ...tx,
    category: tx.categoryId ? db.categories.find((c) => c.id === tx.categoryId) || null : null,
    account: tx.accountId ? db.accounts.find((a) => a.id === tx.accountId) || null : null,
  };
}

function balanceDelta(tx) {
  return tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
}

function applyToAccount(db, accountId, delta) {
  if (!accountId) return;
  const account = db.accounts.find((a) => a.id === accountId);
  if (account) account.balance = round2(Number(account.balance) + delta);
}

/** Valor das posições vinculadas a uma conta de investimento. */
function investedValueFor(db, accountId) {
  return round2(
    db.investments
      .filter((i) => i.accountId === accountId && i.isActive !== false)
      .reduce((sum, i) => sum + Number(i.quantity) * Number(i.currentPrice ?? i.averagePrice), 0),
  );
}

function enrichAccount(db, account) {
  if (account.type !== 'investment') return account;
  return { ...account, investedValue: investedValueFor(db, account.id) };
}

function enrichInvestment(inv) {
  const price = Number(inv.currentPrice ?? inv.averagePrice);
  const qty = Number(inv.quantity);
  const avg = Number(inv.averagePrice);
  const currentValue = qty * price;
  const invested = qty * avg;
  const absoluteGain = qty > 0 && avg > 0 ? currentValue - invested : 0;
  const percentageGain = qty > 0 && avg > 0 ? (absoluteGain / invested) * 100 : 0;
  return { ...inv, currentValue, absoluteGain, percentageGain };
}

/** Recalcula posição e taxa média de um ativo a partir das suas transações. */
function recalcInvestment(db, investmentId) {
  const inv = db.investments.find((i) => i.id === investmentId);
  if (!inv) return;

  const txs = db.investmentTransactions.filter((t) => t.investmentId === investmentId);
  const { quantity, averagePrice } = calculateAveragePrice(txs);
  const rate = calculateAverageInterestRate(txs);

  inv.quantity = quantity;
  inv.averagePrice = round2(averagePrice);
  inv.isActive = quantity > 0;
  if (rate != null) inv.interestRate = rate;
  inv.updatedAt = nowIso();
}

const OFFLINE_QUOTE = {
  error: 'Cotações não estão disponíveis no modo offline. Informe o preço manualmente.',
  stale: true,
};

/* -------------------------------------------------------------------- rotas */

const routes = [
  /* ---------------------------------------------------------------- auth */
  {
    match: (m, s) => s[0] === 'auth' && s[1] === 'me',
    run: () => loadDatabase().user,
  },
  {
    match: (m, s) => s[0] === 'auth' && (s[1] === 'login' || s[1] === 'register'),
    run: () => {
      const db = loadDatabase();
      return { user: db.user, token: 'standalone' };
    },
  },
  {
    match: (m, s) => m === 'PUT' && s[0] === 'auth' && s[1] === 'profile',
    run: (ctx) =>
      mutate((db) => {
        if (ctx.data.name !== undefined) db.user.name = ctx.data.name;
        if (ctx.data.email !== undefined) db.user.email = ctx.data.email;
        db.user.updatedAt = nowIso();
        return db.user;
      }),
  },
  {
    match: (m, s) => m === 'PUT' && s[0] === 'auth' && s[1] === 'password',
    run: () => {
      throw fail('Não existe senha no modo offline — seus dados ficam só neste navegador.', 400);
    },
  },
  {
    match: (m, s) => s[0] === 'auth' && s[1] === 'onboarding',
    run: () =>
      mutate((db) => {
        db.user.onboardingCompletedAt = db.user.onboardingCompletedAt || nowIso();
        return db.user;
      }),
  },

  /* ------------------------------------------------------------ accounts */
  {
    match: (m, s) => m === 'GET' && s[0] === 'accounts' && s.length === 1,
    run: () => {
      const db = loadDatabase();
      return [...db.accounts]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((a) => ({
          ...enrichAccount(db, a),
          _count: { transactions: db.transactions.filter((t) => t.accountId === a.id).length },
        }));
    },
  },
  {
    match: (m, s) => m === 'POST' && s[0] === 'accounts' && s.length === 1,
    run: (ctx) =>
      mutate((db) => {
        const { name, type, balance = 0, color = '#10b981' } = ctx.data;
        if (!name) throw fail('Nome é obrigatório');
        const normalized =
          type === 'investment' ? 0 : type === 'credit_card' ? -Math.abs(balance) : Number(balance);

        const account = {
          id: uuid(),
          name,
          type,
          balance: normalized,
          initialBalance: normalized,
          color,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        db.accounts.push(account);
        return enrichAccount(db, account);
      }),
  },
  {
    match: (m, s) => m === 'PUT' && s[0] === 'accounts' && s.length === 2,
    run: (ctx) =>
      mutate((db) => {
        const account = findOr404(db.accounts, ctx.segments[1], 'Conta');
        const finalType = ctx.data.type ?? account.type;

        if (ctx.data.name !== undefined) account.name = ctx.data.name;
        if (ctx.data.color !== undefined) account.color = ctx.data.color;
        if (ctx.data.type !== undefined) account.type = ctx.data.type;

        if (finalType === 'investment') {
          account.balance = 0;
          account.initialBalance = 0;
        } else if (ctx.data.balance !== undefined) {
          const normalized =
            finalType === 'credit_card' ? -Math.abs(ctx.data.balance) : Number(ctx.data.balance);
          const delta = normalized - Number(account.balance);
          account.balance = normalized;
          account.initialBalance = round2(Number(account.initialBalance) + delta);
        }

        account.updatedAt = nowIso();
        return enrichAccount(db, account);
      }),
  },
  {
    match: (m, s) => m === 'DELETE' && s[0] === 'accounts' && s.length === 2,
    run: (ctx) =>
      mutate((db) => {
        const id = ctx.segments[1];
        findOr404(db.accounts, id, 'Conta');
        const count = db.transactions.filter((t) => t.accountId === id).length;
        if (count > 0) {
          throw fail(
            `Esta conta tem ${count} ${count === 1 ? 'transação vinculada' : 'transações vinculadas'}. ` +
              'Exclua ou mova essas transações antes de remover a conta.',
            409,
          );
        }
        db.accounts = db.accounts.filter((a) => a.id !== id);
        return null;
      }),
  },
  {
    match: (m, s) => m === 'GET' && s[0] === 'accounts' && s.length === 2,
    run: (ctx) => {
      const db = loadDatabase();
      return enrichAccount(db, findOr404(db.accounts, ctx.segments[1], 'Conta'));
    },
  },

  /* ---------------------------------------------------------- categories */
  {
    match: (m, s) => m === 'GET' && s[0] === 'categories' && s.length === 1,
    run: (ctx) => {
      const db = loadDatabase();
      return db.categories
        .filter((c) => !ctx.query.type || c.type === ctx.query.type)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  },
  {
    match: (m, s) => m === 'POST' && s[0] === 'categories',
    run: (ctx) =>
      mutate((db) => {
        const category = {
          id: uuid(),
          name: ctx.data.name,
          type: ctx.data.type,
          color: ctx.data.color || '#6366f1',
          icon: ctx.data.icon || 'tag',
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        db.categories.push(category);
        return category;
      }),
  },
  {
    match: (m, s) => m === 'PUT' && s[0] === 'categories' && s.length === 2,
    run: (ctx) =>
      mutate((db) => {
        const category = findOr404(db.categories, ctx.segments[1], 'Categoria');
        Object.assign(category, ctx.data, { updatedAt: nowIso() });
        return category;
      }),
  },
  {
    match: (m, s) => m === 'DELETE' && s[0] === 'categories' && s.length === 2,
    run: (ctx) =>
      mutate((db) => {
        const id = ctx.segments[1];
        findOr404(db.categories, id, 'Categoria');
        db.categories = db.categories.filter((c) => c.id !== id);
        db.transactions.forEach((t) => {
          if (t.categoryId === id) t.categoryId = null;
        });
        return null;
      }),
  },

  /* -------------------------------------------------------- transactions */
  {
    match: (m, s) => m === 'GET' && s[0] === 'transactions' && s.length === 1,
    run: (ctx) => {
      const db = loadDatabase();
      const { type, categoryId, accountId, startDate, endDate, search, excludeInternal, limit } =
        ctx.query;

      let rows = db.transactions.filter((t) => {
        if (type && t.type !== type) return false;
        if (categoryId && t.categoryId !== categoryId) return false;
        if (accountId && t.accountId !== accountId) return false;
        if (startDate && new Date(t.date) < new Date(startDate)) return false;
        if (endDate && new Date(t.date) > new Date(endDate)) return false;
        if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
        if (excludeInternal === 'true' && t.internalTransfer) return false;
        return true;
      });

      rows.sort((a, b) => new Date(b.date) - new Date(a.date));
      const take = Number.parseInt(limit, 10);
      if (Number.isFinite(take) && take > 0) rows = rows.slice(0, take);

      return rows.map((t) => withRelations(db, t));
    },
  },
  {
    match: (m, s) => m === 'POST' && s[0] === 'transactions',
    run: (ctx) =>
      mutate((db) => {
        const d = ctx.data;
        if (d.accountId) findOr404(db.accounts, d.accountId, 'Conta');
        if (d.categoryId) findOr404(db.categories, d.categoryId, 'Categoria');

        const tx = {
          id: uuid(),
          description: d.description,
          amount: Number(d.amount),
          type: d.type,
          date: d.date ? new Date(d.date).toISOString() : nowIso(),
          categoryId: d.categoryId ?? null,
          accountId: d.accountId ?? null,
          notes: d.notes ?? null,
          internalTransfer: false,
          importBatchId: null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };

        db.transactions.push(tx);
        applyToAccount(db, tx.accountId, balanceDelta(tx));
        return withRelations(db, tx);
      }),
  },
  {
    match: (m, s) => m === 'PUT' && s[0] === 'transactions' && s.length === 2,
    run: (ctx) =>
      mutate((db) => {
        const tx = findOr404(db.transactions, ctx.segments[1], 'Transação');
        const d = ctx.data;
        if (d.accountId) findOr404(db.accounts, d.accountId, 'Conta');
        if (d.categoryId) findOr404(db.categories, d.categoryId, 'Categoria');

        const previous = { ...tx };
        applyToAccount(db, previous.accountId, -balanceDelta(previous));

        if (d.description !== undefined) tx.description = d.description;
        if (d.amount !== undefined) tx.amount = Number(d.amount);
        if (d.type !== undefined) tx.type = d.type;
        if (d.date !== undefined) tx.date = new Date(d.date).toISOString();
        if (d.categoryId !== undefined) tx.categoryId = d.categoryId ?? null;
        if (d.accountId !== undefined) tx.accountId = d.accountId ?? null;
        if (d.notes !== undefined) tx.notes = d.notes;
        tx.updatedAt = nowIso();

        applyToAccount(db, tx.accountId, balanceDelta(tx));
        return withRelations(db, tx);
      }),
  },
  {
    match: (m, s) => m === 'DELETE' && s[0] === 'transactions' && s.length === 2,
    run: (ctx) =>
      mutate((db) => {
        const tx = findOr404(db.transactions, ctx.segments[1], 'Transação');
        applyToAccount(db, tx.accountId, -balanceDelta(tx));
        db.transactions = db.transactions.filter((t) => t.id !== tx.id);
        return null;
      }),
  },

  /* ------------------------------------------------------------ dashboard */
  {
    match: (m, s) => s[0] === 'dashboard' && s[1] === 'summary',
    run: (ctx) => {
      const db = loadDatabase();
      const { startDate, endDate, period } = ctx.query;

      let range = null;
      if (period === 'all') {
        range = null;
      } else if (startDate || endDate) {
        range = { gte: startDate ? new Date(startDate) : null, lte: endDate ? new Date(endDate) : null };
      } else {
        const now = new Date();
        range = {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
          lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
        };
      }

      const inRange = db.transactions.filter((t) => {
        if (!range) return true;
        const d = new Date(t.date);
        if (range.gte && d < range.gte) return false;
        if (range.lte && d > range.lte) return false;
        return true;
      });

      const nonInternal = inRange.filter((t) => !t.internalTransfer);
      const sum = (type) =>
        nonInternal.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0);

      const totalIncome = sum('income');
      const totalExpense = sum('expense');

      const expensesByCategory = {};
      for (const t of nonInternal.filter((x) => x.type === 'expense')) {
        const name = db.categories.find((c) => c.id === t.categoryId)?.name || 'Sem categoria';
        expensesByCategory[name] = (expensesByCategory[name] || 0) + Number(t.amount);
      }

      return {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        accountsBalance: db.accounts
          .filter((a) => a.type !== 'investment')
          .reduce((s, a) => s + Number(a.balance), 0),
        expensesByCategory,
        transactionCount: inRange.length,
        internalTransferCount: inRange.length - nonInternal.length,
        period: range
          ? { start: range.gte?.toISOString() ?? null, end: range.lte?.toISOString() ?? null }
          : null,
      };
    },
  },
  {
    match: (m, s) => s[0] === 'dashboard' && s[1] === 'monthly',
    run: (ctx) => {
      const db = loadDatabase();
      const year = Number(ctx.query.year) || new Date().getFullYear();
      const months = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        monthName: new Date(year, i, 1).toLocaleDateString('pt-BR', { month: 'short' }),
        income: 0,
        expense: 0,
      }));

      for (const t of db.transactions) {
        const d = new Date(t.date);
        if (d.getFullYear() !== year) continue;
        months[d.getMonth()][t.type === 'income' ? 'income' : 'expense'] += Number(t.amount);
      }
      return months;
    },
  },

  /* ---------------------------------------------------------------- goals */
  {
    match: (m, s) => m === 'GET' && s[0] === 'goals' && s.length === 1,
    run: () => [...loadDatabase().goals].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  },
  {
    match: (m, s) => m === 'POST' && s[0] === 'goals',
    run: (ctx) =>
      mutate((db) => {
        const d = ctx.data;
        const years = Number(d.years);
        const monthlyRatePct = Number(d.monthlyRatePct);
        const targetFinalValue = Number(d.targetFinalValue);
        const start = d.startDate ? new Date(d.startDate) : new Date();

        const monthlyContribution = pmtFromFutureValue({
          targetFinalValue,
          monthlyRatePct,
          months: years * 12,
        });

        const goal = {
          id: uuid(),
          name: d.name,
          years,
          monthlyRatePct,
          targetFinalValue,
          monthlyContribution,
          startDate: start.toISOString(),
          createdAt: nowIso(),
          updatedAt: nowIso(),
          installments: buildInstallments({ startDate: start, years, monthlyRatePct, monthlyContribution }),
        };
        db.goals.push(goal);
        return goal;
      }),
  },
  {
    match: (m, s) => m === 'PATCH' && s[0] === 'goals' && s[1] === 'installments',
    run: (ctx) =>
      mutate((db) => {
        const id = ctx.segments[2];
        for (const goal of db.goals) {
          const inst = goal.installments.find((i) => i.id === id);
          if (inst) {
            inst.status = ctx.data.status;
            return inst;
          }
        }
        throw fail('Parcela não encontrada', 404);
      }),
  },
  {
    match: (m, s) => m === 'DELETE' && s[0] === 'goals' && s.length === 2,
    run: (ctx) =>
      mutate((db) => {
        findOr404(db.goals, ctx.segments[1], 'Meta');
        db.goals = db.goals.filter((g) => g.id !== ctx.segments[1]);
        return null;
      }),
  },

  /* ------------------------------------------------------------- planning */
  {
    match: (m, s) => m === 'GET' && s[0] === 'planning',
    run: () =>
      [...loadDatabase().planningItems].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  },
  {
    match: (m, s) => m === 'POST' && s[0] === 'planning',
    run: (ctx) =>
      mutate((db) => {
        const item = {
          id: uuid(),
          ...buildPlanningFields(ctx.data),
          enabled: true,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        db.planningItems.push(item);
        return item;
      }),
  },
  {
    match: (m, s) => m === 'PUT' && s[0] === 'planning' && s.length === 2,
    run: (ctx) =>
      mutate((db) => {
        const item = findOr404(db.planningItems, ctx.segments[1], 'Item');
        Object.assign(item, buildPlanningFields(ctx.data), { updatedAt: nowIso() });
        return item;
      }),
  },
  {
    match: (m, s) => m === 'DELETE' && s[0] === 'planning' && s.length === 2,
    run: (ctx) =>
      mutate((db) => {
        findOr404(db.planningItems, ctx.segments[1], 'Item');
        db.planningItems = db.planningItems.filter((i) => i.id !== ctx.segments[1]);
        return null;
      }),
  },

  /* ---------------------------------------------------------- investments */
  {
    match: (m, s) => m === 'GET' && s[0] === 'investments' && s[1] === 'summary',
    run: () => {
      const db = loadDatabase();
      const active = db.investments.filter((i) => i.isActive !== false);
      let totalInvested = 0;
      let totalCurrent = 0;
      const allocationByType = {};

      for (const inv of active) {
        const qty = Number(inv.quantity);
        const invested = qty * Number(inv.averagePrice);
        const current = qty * Number(inv.currentPrice ?? inv.averagePrice);
        totalInvested += invested;
        totalCurrent += current;
        allocationByType[inv.assetType] = (allocationByType[inv.assetType] || 0) + current;
      }

      const totalGain = totalCurrent - totalInvested;
      return {
        totalInvested: round2(totalInvested),
        totalCurrent: round2(totalCurrent),
        totalGain: round2(totalGain),
        totalGainPct: totalInvested > 0 ? round2((totalGain / totalInvested) * 100) : 0,
        allocationByType,
        totalAssets: active.length,
      };
    },
  },
  {
    match: (m, s) => m === 'GET' && s[0] === 'investments' && s[1] === 'allocation',
    run: () => {
      const db = loadDatabase();
      const byType = {};
      const byBroker = {};
      const byTicker = {};
      for (const inv of db.investments.filter((i) => i.isActive !== false)) {
        const value = Number(inv.quantity) * Number(inv.currentPrice ?? inv.averagePrice);
        byType[inv.assetType] = (byType[inv.assetType] || 0) + value;
        byBroker[inv.broker || 'Não informada'] = (byBroker[inv.broker || 'Não informada'] || 0) + value;
        byTicker[inv.ticker || inv.name] = (byTicker[inv.ticker || inv.name] || 0) + value;
      }
      return { byType, byBroker, byTicker };
    },
  },
  {
    match: (m, s) => m === 'GET' && s[0] === 'investments' && s[1] === 'evolution',
    run: (ctx) => {
      const db = loadDatabase();
      const months = Number(ctx.query.months) || 12;
      const now = new Date();
      const data = {};

      for (let i = 0; i < months; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
        data[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = {
          aportes: 0,
          resgates: 0,
          proventos: 0,
        };
      }

      for (const tx of db.investmentTransactions) {
        const d = new Date(tx.transactionDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!data[key]) continue;
        const amount = Number(tx.totalAmount);
        if (tx.type === 'APORTE') data[key].aportes += amount;
        else if (tx.type === 'RESGATE') data[key].resgates += amount;
        else if (['DIVIDENDO', 'JCP', 'RENDIMENTO'].includes(tx.type)) data[key].proventos += amount;
      }

      const currentTotal = db.investments
        .filter((i) => i.isActive !== false)
        .reduce((s, i) => s + Number(i.quantity) * Number(i.currentPrice ?? i.averagePrice), 0);

      return {
        evolution: Object.entries(data).map(([month, v]) => ({ month, ...v })),
        currentTotal: round2(currentTotal),
      };
    },
  },
  {
    match: (m, s) => m === 'GET' && s[0] === 'investments' && s[1] === 'dividends',
    run: (ctx) => {
      const db = loadDatabase();
      const year = Number(ctx.query.year) || new Date().getFullYear();
      const byMonth = {};
      for (let m = 1; m <= 12; m++) byMonth[m] = { total: 0, items: [] };

      for (const tx of db.investmentTransactions) {
        if (!['DIVIDENDO', 'JCP', 'RENDIMENTO'].includes(tx.type)) continue;
        const d = new Date(tx.transactionDate);
        if (d.getFullYear() !== year) continue;
        const inv = db.investments.find((i) => i.id === tx.investmentId);
        const month = d.getMonth() + 1;
        byMonth[month].total += Number(tx.totalAmount);
        byMonth[month].items.push({
          id: tx.id,
          type: tx.type,
          amount: Number(tx.totalAmount),
          date: tx.transactionDate,
          asset: inv?.ticker || inv?.name || '—',
        });
      }

      return {
        year,
        byMonth,
        totalYear: round2(Object.values(byMonth).reduce((s, m) => s + m.total, 0)),
      };
    },
  },
  {
    match: (m, s) => m === 'GET' && s[0] === 'investments' && s.length === 1,
    run: () => loadDatabase().investments.map(enrichInvestment),
  },
  {
    match: (m, s) => m === 'POST' && s[0] === 'investments' && s.length === 1,
    run: (ctx) =>
      mutate((db) => {
        const d = ctx.data;
        if (!d.assetType || !d.name) throw fail('Tipo de ativo e nome são obrigatórios');
        if (!d.purchaseDate) throw fail('Data de compra é obrigatória');

        const account = d.accountId ? db.accounts.find((a) => a.id === d.accountId) : null;
        const inv = {
          id: uuid(),
          assetType: d.assetType,
          ticker: d.ticker || null,
          name: d.name,
          broker: account ? account.name : d.broker || null,
          accountId: d.accountId || null,
          indexer: d.indexer || null,
          interestRate: d.interestRate != null ? Number(d.interestRate) : null,
          maturityDate: d.maturityDate ? new Date(d.maturityDate).toISOString() : null,
          liquidityDays:
            d.assetType === 'TESOURO_DIRETO' || d.liquidityDays == null
              ? null
              : Number(d.liquidityDays),
          purchaseDate: new Date(d.purchaseDate).toISOString(),
          notes: d.notes || null,
          quantity: 0,
          averagePrice: 0,
          currentPrice: null,
          lastPriceUpdate: null,
          isActive: true,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        db.investments.push(inv);
        return enrichInvestment(inv);
      }),
  },
  {
    match: (m, s) => s[0] === 'investments' && s.length === 3 && s[2] === 'refresh-price',
    run: () => {
      throw fail(
        'Cotações automáticas não funcionam no modo offline. Edite o ativo e informe o preço atual.',
        503,
      );
    },
  },
  {
    match: (m, s) => m === 'GET' && s[0] === 'investments' && s.length === 3 && s[2] === 'transactions',
    run: (ctx) =>
      loadDatabase()
        .investmentTransactions.filter((t) => t.investmentId === ctx.segments[1])
        .sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate)),
  },
  {
    match: (m, s) => m === 'POST' && s[0] === 'investments' && s.length === 3 && s[2] === 'transactions',
    run: (ctx) =>
      mutate((db) => {
        const investmentId = ctx.segments[1];
        const inv = findOr404(db.investments, investmentId, 'Investimento');
        const d = ctx.data;

        if (!d.type || !d.transactionDate) throw fail('Tipo e data são obrigatórios');
        if (new Date(d.transactionDate) > new Date()) {
          throw fail('Data de transação não pode ser futura');
        }
        const qty = Number(d.quantity) || 0;
        if (d.type === 'RESGATE' && qty > Number(inv.quantity)) {
          throw fail(
            `Quantidade de resgate (${qty}) excede a quantidade atual (${Number(inv.quantity)})`,
          );
        }

        const tx = {
          id: uuid(),
          investmentId,
          type: d.type,
          quantity: qty,
          unitPrice: Number(d.unitPrice) || 0,
          totalAmount: Number(d.totalAmount) || qty * (Number(d.unitPrice) || 0),
          fees: Number(d.fees) || 0,
          interestRate: d.type === 'APORTE' && d.interestRate != null ? Number(d.interestRate) : null,
          transactionDate: new Date(d.transactionDate).toISOString(),
          notes: d.notes || null,
          createdAt: nowIso(),
        };

        db.investmentTransactions.push(tx);
        recalcInvestment(db, investmentId);
        return tx;
      }),
  },
  {
    match: (m, s) => m === 'PUT' && s[0] === 'investments' && s.length === 2,
    run: (ctx) =>
      mutate((db) => {
        const inv = findOr404(db.investments, ctx.segments[1], 'Investimento');
        const d = ctx.data;
        const account = d.accountId ? db.accounts.find((a) => a.id === d.accountId) : null;

        for (const field of ['assetType', 'ticker', 'name', 'indexer', 'notes']) {
          if (d[field] !== undefined) inv[field] = d[field] || null;
        }
        if (d.accountId !== undefined) inv.accountId = d.accountId || null;
        if (d.accountId !== undefined || d.broker !== undefined) {
          inv.broker = account ? account.name : d.broker || null;
        }
        if (d.interestRate !== undefined) {
          inv.interestRate = d.interestRate != null ? Number(d.interestRate) : null;
        }
        // Sem cotação automática, o preço atual é editável à mão.
        if (d.currentPrice !== undefined) {
          inv.currentPrice = d.currentPrice != null ? Number(d.currentPrice) : null;
          inv.lastPriceUpdate = nowIso();
        }
        if (d.maturityDate !== undefined) {
          inv.maturityDate = d.maturityDate ? new Date(d.maturityDate).toISOString() : null;
        }
        if (d.purchaseDate !== undefined) inv.purchaseDate = new Date(d.purchaseDate).toISOString();
        if (d.isActive !== undefined) inv.isActive = d.isActive;
        inv.updatedAt = nowIso();

        return enrichInvestment(inv);
      }),
  },
  {
    match: (m, s) => m === 'DELETE' && s[0] === 'investments' && s.length === 2,
    run: (ctx) =>
      mutate((db) => {
        const id = ctx.segments[1];
        findOr404(db.investments, id, 'Investimento');
        db.investments = db.investments.filter((i) => i.id !== id);
        db.investmentTransactions = db.investmentTransactions.filter((t) => t.investmentId !== id);
        return null;
      }),
  },
  {
    match: (m, s) => m === 'GET' && s[0] === 'investments' && s.length === 2,
    run: (ctx) => {
      const db = loadDatabase();
      const inv = findOr404(db.investments, ctx.segments[1], 'Investimento');
      return enrichInvestment(inv);
    },
  },
  {
    match: (m, s) => s[0] === 'investment-transactions' && s.length === 2,
    run: (ctx) =>
      mutate((db) => {
        const tx = findOr404(db.investmentTransactions, ctx.segments[1], 'Transação');
        if (ctx.method === 'DELETE') {
          db.investmentTransactions = db.investmentTransactions.filter((t) => t.id !== tx.id);
        } else {
          Object.assign(tx, ctx.data);
        }
        recalcInvestment(db, tx.investmentId);
        return ctx.method === 'DELETE' ? null : tx;
      }),
  },

  /* ----------------------------------------------------- investment goals */
  {
    match: (m, s) => m === 'GET' && s[0] === 'investment-goals' && s.length === 1,
    run: () => loadDatabase().investmentGoals,
  },
  {
    match: (m, s) => m === 'POST' && s[0] === 'investment-goals',
    run: (ctx) =>
      mutate((db) => {
        const goal = { id: uuid(), ...ctx.data, createdAt: nowIso(), updatedAt: nowIso() };
        db.investmentGoals.push(goal);
        return goal;
      }),
  },
  {
    match: (m, s) => s[0] === 'investment-goals' && s.length === 3 && s[2] === 'projection',
    run: (ctx) => {
      const db = loadDatabase();
      const goal = findOr404(db.investmentGoals, ctx.segments[1], 'Meta');
      const months = Number(goal.months) || 60;
      return {
        goal,
        projections: projectGoal(
          goal.currentAmount || 0,
          goal.monthlyContribution || 0,
          goal.expectedReturn || 0,
          months,
        ),
      };
    },
  },
  {
    match: (m, s) => m === 'PUT' && s[0] === 'investment-goals' && s.length === 2,
    run: (ctx) =>
      mutate((db) => {
        const goal = findOr404(db.investmentGoals, ctx.segments[1], 'Meta');
        Object.assign(goal, ctx.data, { updatedAt: nowIso() });
        return goal;
      }),
  },
  {
    match: (m, s) => m === 'DELETE' && s[0] === 'investment-goals' && s.length === 2,
    run: (ctx) =>
      mutate((db) => {
        findOr404(db.investmentGoals, ctx.segments[1], 'Meta');
        db.investmentGoals = db.investmentGoals.filter((g) => g.id !== ctx.segments[1]);
        return null;
      }),
  },

  /* --------------------------------------------------------------- market */
  { match: (m, s) => s[0] === 'market' && s[1] === 'quote', run: () => OFFLINE_QUOTE },
  { match: (m, s) => s[0] === 'market' && s[1] === 'treasury', run: () => ({ count: 0, titles: [] }) },
  { match: (m, s) => s[0] === 'market' && s[1] === 'indices', run: () => ({ cdi: null, ibov: null }) },
  { match: (m, s) => s[0] === 'market' && s[1] === 'index-history', run: () => [] },
  {
    match: (m, s) => s[0] === 'market' && s[1] === 'refresh-all',
    run: () => ({ updated: 0, total: 0, results: [] }),
  },

  /* --------------------------------------------------- import / manutenção */
  { match: (m, s) => s[0] === 'import' && s[1] === 'batches' && s.length === 2, run: () => [] },
  {
    match: (m, s) => s[0] === 'import',
    run: () => {
      throw fail(
        'Importação de extrato precisa do servidor e não funciona no modo offline. ' +
          'Cadastre as transações manualmente.',
        503,
      );
    },
  },
  {
    match: (m, s) => s[0] === 'maintenance' && s[1] === 'purge',
    run: (ctx) =>
      mutate((db) => {
        const { range, startDate, endDate } = ctx.data;
        const now = new Date();
        const dias = { last24h: 1, last7d: 7, last30d: 30 }[range];

        let start;
        let end = now;
        if (dias) {
          start = new Date(now.getTime() - dias * 86400000);
        } else if (range === 'custom') {
          if (!startDate || !endDate) throw fail('Informe as duas datas para o período personalizado.');
          start = new Date(startDate);
          end = new Date(endDate);
        } else {
          throw fail('Período inválido.');
        }

        const before = db.transactions.length;
        db.transactions = db.transactions.filter((t) => {
          const d = new Date(t.date);
          return d < start || d > end;
        });

        // Recalcula os saldos a partir do saldo de abertura, como o backend faz.
        for (const account of db.accounts) {
          if (account.type === 'investment') {
            account.balance = 0;
            continue;
          }
          const movimento = db.transactions
            .filter((t) => t.accountId === account.id)
            .reduce((s, t) => s + balanceDelta(t), 0);
          account.balance = round2(Number(account.initialBalance || 0) + movimento);
        }

        return { deleted: before - db.transactions.length, range };
      }),
  },
  {
    match: (m, s) => s[0] === 'rules',
    run: (ctx) =>
      mutate((db) => {
        const transactionId = ctx.segments[2];
        const tx = findOr404(db.transactions, transactionId, 'Transação');
        const { categoryId } = ctx.data;
        findOr404(db.categories, categoryId, 'Categoria');

        const key = tx.description.toLowerCase().slice(0, 24).trim();
        let updated = 0;
        for (const other of db.transactions) {
          if (other.type !== tx.type) continue;
          if (!other.description.toLowerCase().includes(key)) continue;
          other.categoryId = categoryId;
          updated += 1;
        }
        return { key, updatedCount: updated, scope: ctx.data.scope || 'all' };
      }),
  },

  /* -------------------------------------------------------- subscriptions */
  { match: (m, s) => s[0] === 'subscriptions' && s[1] === 'plans', run: () => [loadDatabase().user.subscription.plan] },
  { match: (m, s) => s[0] === 'subscriptions' && s.length === 1, run: () => loadDatabase().user.subscription },
  {
    match: (m, s) => s[0] === 'subscriptions',
    run: () => loadDatabase().user.subscription,
  },
];

function buildPlanningFields(d) {
  let startDate;
  if (typeof d.startDate === 'string' && /^\d{4}-\d{2}$/.test(d.startDate)) {
    const [year, month] = d.startDate.split('-').map(Number);
    startDate = new Date(Date.UTC(year, month - 1, 1));
  } else if (d.startDate) {
    const parsed = new Date(d.startDate);
    startDate = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
  } else {
    const now = new Date();
    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  return {
    name: d.name,
    amount: Number(d.amount),
    type: d.type,
    dayOfMonth: Number(d.dayOfMonth) || 1,
    monthsDuration: d.monthsDuration ? Number(d.monthsDuration) : null,
    startDate: startDate.toISOString(),
  };
}

/* ------------------------------------------------------------- ponto de entrada */

export async function handleStandaloneRequest(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const { segments, query } = parseEndpoint(endpoint);
  const ctx = { method, segments, query, data: body(options) };

  const route = routes.find((r) => r.match(method, segments));
  if (!route) {
    throw fail(`Recurso não disponível no modo offline (${method} ${endpoint}).`, 404);
  }

  return route.run(ctx);
}
