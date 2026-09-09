/**
 * Testes do modo autônomo.
 *
 *   npm run test
 *
 * Exercitam `src/services/standalone/backend.js` — a implementação que substitui a API
 * quando a aplicação roda sem servidor. Como não há backend para conferir os números,
 * é aqui que os saldos, o preço médio e a projeção precisam ser garantidos.
 *
 * O único requisito de ambiente é um `localStorage`; o resto é código de produção.
 */
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Precisa existir antes do primeiro import do store.
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear(),
};

const { handleStandaloneRequest: call } = await import('../src/services/standalone/backend.js');
const { resetDatabase, exportDatabase, importDatabase } = await import(
  '../src/services/standalone/store.js'
);

const post = (path, data) => call(path, { method: 'POST', body: JSON.stringify(data) });
const put = (path, data) => call(path, { method: 'PUT', body: JSON.stringify(data) });
const del = (path) => call(path, { method: 'DELETE' });

beforeEach(() => {
  memory.clear();
  resetDatabase();
});

test('abre já utilizável: usuário local e categorias padrão', async () => {
  const user = await call('/auth/me');
  assert.ok(user.id, 'existe um usuário local, sem login');
  assert.equal(user.onboardingCompletedAt, null, 'a apresentação de primeiro uso aparece');

  const categorias = await call('/categories');
  assert.ok(categorias.length >= 10, 'categorias vêm prontas');
  assert.ok(categorias.some((c) => c.type === 'income'));
  assert.ok(categorias.some((c) => c.type === 'expense'));
});

test('saldo da conta acompanha criar, editar e excluir transação', async () => {
  const conta = await post('/accounts', { name: 'Nubank', type: 'checking', balance: 1000 });
  assert.equal(conta.balance, 1000);
  assert.equal(conta.initialBalance, 1000);

  const tx = await post('/transactions', {
    description: 'Mercado',
    amount: 250.5,
    type: 'expense',
    accountId: conta.id,
  });
  assert.equal((await call(`/accounts/${conta.id}`)).balance, 749.5);

  await put(`/transactions/${tx.id}`, { amount: 300 });
  assert.equal((await call(`/accounts/${conta.id}`)).balance, 700);

  await del(`/transactions/${tx.id}`);
  assert.equal((await call(`/accounts/${conta.id}`)).balance, 1000, 'volta ao saldo original');
});

test('cartão de crédito guarda dívida como valor negativo', async () => {
  const cartao = await post('/accounts', { name: 'Cartão', type: 'credit_card', balance: 500 });
  assert.equal(cartao.balance, -500);

  const editado = await put(`/accounts/${cartao.id}`, { balance: 300 });
  assert.equal(editado.balance, -300, 'edição parcial mantém o sinal');
});

test('conta com transações não é excluída', async () => {
  const conta = await post('/accounts', { name: 'Itaú', type: 'checking', balance: 0 });
  await post('/transactions', {
    description: 'Salário',
    amount: 3000,
    type: 'income',
    accountId: conta.id,
  });

  await assert.rejects(() => del(`/accounts/${conta.id}`), (err) => err.status === 409);
});

test('resumo do dashboard usa o mês corrente por padrão', async () => {
  const conta = await post('/accounts', { name: 'Conta', type: 'checking', balance: 0 });
  const hoje = new Date().toISOString();
  const anoPassado = new Date(Date.now() - 400 * 86400000).toISOString();

  await post('/transactions', { description: 'Deste mês', amount: 100, type: 'expense', date: hoje, accountId: conta.id });
  await post('/transactions', { description: 'Antigo', amount: 999, type: 'expense', date: anoPassado, accountId: conta.id });

  const doMes = await call('/dashboard/summary');
  assert.equal(doMes.totalExpense, 100, 'a transação antiga fica de fora');
  assert.ok(doMes.period, 'o período usado vem na resposta');

  const tudo = await call('/dashboard/summary?period=all');
  assert.equal(tudo.totalExpense, 1099);
  assert.equal(tudo.period, null);
});

test('meta gera cronograma sem pular meses', async () => {
  const meta = await post('/goals', {
    name: 'Reserva',
    years: 1,
    monthlyRatePct: 0.8,
    targetFinalValue: 12000,
    startDate: '2026-01-31',
  });

  assert.equal(meta.installments.length, 12);
  assert.ok(meta.monthlyContribution > 0, 'o aporte mensal é calculado');

  const meses = meta.installments.slice(0, 4).map((i) => new Date(i.paymentDate).getMonth());
  assert.deepEqual(meses, [0, 1, 2, 3], 'janeiro, fevereiro, março, abril — nenhum pulado');
});

test('planejamento grava mês de início absoluto', async () => {
  const item = await post('/planning', {
    name: 'Décimo terceiro',
    amount: 3000,
    type: 'income',
    dayOfMonth: 20,
    monthsDuration: 1,
    startDate: '2026-11',
  });

  const d = new Date(item.startDate);
  assert.equal(d.getUTCFullYear(), 2026);
  assert.equal(d.getUTCMonth(), 10, 'novembro');
  assert.equal(d.getUTCDate(), 1);
});

test('investimento: preço médio e posição saem das transações', async () => {
  const inv = await post('/investments', {
    assetType: 'ACAO',
    ticker: 'PETR4',
    name: 'Petrobras',
    purchaseDate: '2026-01-10',
  });

  await post(`/investments/${inv.id}/transactions`, {
    type: 'APORTE', quantity: 10, unitPrice: 20, totalAmount: 200, transactionDate: '2026-02-01',
  });
  await post(`/investments/${inv.id}/transactions`, {
    type: 'APORTE', quantity: 10, unitPrice: 30, totalAmount: 300, transactionDate: '2026-03-01',
  });

  const comPosicao = await call(`/investments/${inv.id}`);
  assert.equal(comPosicao.quantity, 20);
  assert.equal(comPosicao.averagePrice, 25, 'média ponderada de 20 e 30');

  // Preço atual é manual no modo offline (não há cotação).
  await put(`/investments/${inv.id}`, { currentPrice: 28 });
  const valorizado = await call(`/investments/${inv.id}`);
  assert.equal(valorizado.currentValue, 560);
  assert.equal(valorizado.absoluteGain, 60);
  assert.equal(Math.round(valorizado.percentageGain * 100) / 100, 12);
});

test('excluir transação de investimento recalcula a posição', async () => {
  const inv = await post('/investments', {
    assetType: 'ACAO', ticker: 'VALE3', name: 'Vale', purchaseDate: '2026-01-10',
  });
  const tx = await post(`/investments/${inv.id}/transactions`, {
    type: 'APORTE', quantity: 5, unitPrice: 60, totalAmount: 300, transactionDate: '2026-02-01',
  });

  assert.equal((await call(`/investments/${inv.id}`)).quantity, 5);

  await del(`/investment-transactions/${tx.id}`);
  const zerado = await call(`/investments/${inv.id}`);
  assert.equal(zerado.quantity, 0);
  assert.equal(zerado.isActive, false);
});

test('conta de investimento mostra o valor das posições', async () => {
  const conta = await post('/accounts', { name: 'ION', type: 'investment', balance: 0 });
  const inv = await post('/investments', {
    assetType: 'ACAO', ticker: 'ITSA4', name: 'Itaúsa',
    accountId: conta.id, purchaseDate: '2026-01-10',
  });
  await post(`/investments/${inv.id}/transactions`, {
    type: 'APORTE', quantity: 100, unitPrice: 10, totalAmount: 1000, transactionDate: '2026-02-01',
  });

  const contas = await call('/accounts');
  const investimento = contas.find((c) => c.id === conta.id);
  assert.equal(investimento.balance, 0, 'o campo balance segue zero');
  assert.equal(investimento.investedValue, 1000, 'o valor vem das posições');
  assert.equal(inv.broker, 'ION', 'a corretora vem da conta vinculada');
});

test('apagar dados recalcula saldos a partir do saldo de abertura', async () => {
  const conta = await post('/accounts', { name: 'Conta', type: 'checking', balance: 5000 });
  await post('/transactions', {
    description: 'Compra', amount: 200, type: 'expense',
    accountId: conta.id, date: new Date().toISOString(),
  });
  assert.equal((await call(`/accounts/${conta.id}`)).balance, 4800);

  const resultado = await post('/maintenance/purge', { range: 'last24h' });
  assert.equal(resultado.deleted, 1);
  assert.equal(
    (await call(`/accounts/${conta.id}`)).balance,
    5000,
    'os 5000 de abertura não podem sumir',
  );
});

test('backup exporta e restaura o estado', async () => {
  await post('/accounts', { name: 'Antes do backup', type: 'checking', balance: 777 });
  const backup = exportDatabase();

  resetDatabase();
  assert.equal((await call('/accounts')).length, 0, 'zerado');

  importDatabase(backup);
  const restauradas = await call('/accounts');
  assert.equal(restauradas.length, 1);
  assert.equal(restauradas[0].name, 'Antes do backup');
  assert.equal(restauradas[0].balance, 777);
});

test('backup inválido é recusado', () => {
  assert.throws(() => importDatabase('{"nada":true}'), (err) => err.status === 400);
});

test('recursos que dependem do servidor falham com mensagem clara', async () => {
  await assert.rejects(
    () => post('/import/statement', {}),
    (err) => err.status === 503 && /offline/i.test(err.message),
  );

  const cotacao = await call('/market/quote/PETR4?assetType=ACAO');
  assert.ok(cotacao.error, 'cotação devolve erro tratável, não quebra a tela');

  const titulos = await call('/market/treasury');
  assert.deepEqual(titulos, { count: 0, titles: [] }, 'a lista vazia degrada sem erro');
});

test('dados sobrevivem a um "reload" — releitura do armazenamento', async () => {
  await post('/accounts', { name: 'Persistente', type: 'checking', balance: 123 });

  // Simula recarregar a página: o módulo relê do localStorage.
  const salvo = JSON.parse(memory.get('financas_standalone_db'));
  assert.equal(salvo.accounts.length, 1);
  assert.equal(salvo.accounts[0].name, 'Persistente');
});
