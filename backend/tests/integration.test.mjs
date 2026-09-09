/**
 * Testes de integração contra um Postgres real.
 *
 *   npm run test:integration
 *
 * Precisa de DATABASE_URL válido (o .env serve). Cria usuários próprios com
 * e-mail aleatório e apaga tudo no final — não toca em dados existentes.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';

import prisma from '../src/shared/lib/prisma.js';
import * as authService from '../src/modules/auth/auth.service.js';
import * as accountsService from '../src/modules/accounts/accounts.service.js';
import * as transactionsService from '../src/modules/transactions/transactions.service.js';
import { recomputeAccountBalances } from '../src/modules/maintenance/maintenance.repository.js';

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds = [];

async function makeUser() {
  const { user } = await authService.register({
    email: `teste-${suffix()}@exemplo.test`,
    password: 'senha-de-teste-123',
    name: 'Usuário de teste',
  });
  createdUserIds.push(user.id);
  return user;
}

before(async () => {
  await prisma.$connect();
});

after(async () => {
  // Cascade em User remove contas, transações e assinatura.
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

test('B1: transação não pode apontar para a conta de outro usuário', async () => {
  const dono = await makeUser();
  const invasor = await makeUser();

  const contaDoDono = await accountsService.create(dono.id, {
    name: 'Conta do dono',
    type: 'checking',
    balance: 1000,
    color: '#10b981',
  });

  await assert.rejects(
    () =>
      transactionsService.create(invasor.id, {
        description: 'Tentativa de gravar na conta alheia',
        amount: 500,
        type: 'expense',
        accountId: contaDoDono.id,
      }),
    (err) => err.status === 404,
    'a criação deveria ser recusada',
  );

  const depois = await prisma.account.findUnique({ where: { id: contaDoDono.id } });
  assert.equal(Number(depois.balance), 1000, 'o saldo da conta alheia não pode ter mudado');
});

test('B1: categoria de outro usuário também é recusada', async () => {
  const dono = await makeUser();
  const invasor = await makeUser();

  const categoriaDoDono = await prisma.category.create({
    data: { name: `Cat ${suffix()}`, type: 'expense', userId: dono.id },
  });

  await assert.rejects(
    () =>
      transactionsService.create(invasor.id, {
        description: 'Categoria alheia',
        amount: 10,
        type: 'expense',
        categoryId: categoriaDoDono.id,
      }),
    (err) => err.status === 404,
  );
});

test('B3: recalcular saldos preserva o saldo de abertura', async () => {
  const user = await makeUser();

  const conta = await accountsService.create(user.id, {
    name: 'Conta com abertura',
    type: 'checking',
    balance: 5000,
    color: '#10b981',
  });
  assert.equal(Number(conta.initialBalance), 5000);

  await transactionsService.create(user.id, {
    description: 'Mercado',
    amount: 200,
    type: 'expense',
    accountId: conta.id,
  });

  const aposTransacao = await prisma.account.findUnique({ where: { id: conta.id } });
  assert.equal(Number(aposTransacao.balance), 4800, 'saldo após a despesa');

  // É isso que "Apagar dados" e "Apagar por arquivo" disparam.
  await recomputeAccountBalances(user.id);

  const aposRecalculo = await prisma.account.findUnique({ where: { id: conta.id } });
  assert.equal(
    Number(aposRecalculo.balance),
    4800,
    'o recálculo não pode descartar os 5000 de abertura',
  );
});

test('B15: editar só o saldo de um cartão de crédito mantém o sinal negativo', async () => {
  const user = await makeUser();

  const cartao = await accountsService.create(user.id, {
    name: 'Cartão',
    type: 'credit_card',
    balance: 500,
    color: '#ef4444',
  });
  assert.equal(Number(cartao.balance), -500, 'cartão guarda dívida como valor negativo');

  // Edição parcial: o corpo não traz `type`, como a tela faz.
  const editado = await accountsService.update(user.id, cartao.id, { balance: 300 });
  assert.equal(Number(editado.balance), -300, 'continua negativo após a edição');
});

test('B17: conta com transações não é excluída silenciosamente', async () => {
  const user = await makeUser();

  const conta = await accountsService.create(user.id, {
    name: 'Conta com histórico',
    type: 'checking',
    balance: 0,
    color: '#10b981',
  });

  await transactionsService.create(user.id, {
    description: 'Salário',
    amount: 3000,
    type: 'income',
    accountId: conta.id,
  });

  await assert.rejects(
    () => accountsService.remove(user.id, conta.id),
    (err) => err.status === 409 && /transaç/i.test(err.message),
  );
});

test('saldo da conta acompanha criação, edição e exclusão de transação', async () => {
  const user = await makeUser();

  const conta = await accountsService.create(user.id, {
    name: 'Conta corrente',
    type: 'checking',
    balance: 1000,
    color: '#10b981',
  });

  const tx = await transactionsService.create(user.id, {
    description: 'Freela',
    amount: 500,
    type: 'income',
    accountId: conta.id,
  });
  let atual = await prisma.account.findUnique({ where: { id: conta.id } });
  assert.equal(Number(atual.balance), 1500, 'receita soma');

  await transactionsService.update(user.id, tx.id, { amount: 800 });
  atual = await prisma.account.findUnique({ where: { id: conta.id } });
  assert.equal(Number(atual.balance), 1800, 'edição reverte o valor antigo e aplica o novo');

  await transactionsService.remove(user.id, tx.id);
  atual = await prisma.account.findUnique({ where: { id: conta.id } });
  assert.equal(Number(atual.balance), 1000, 'exclusão devolve o saldo original');
});

test('B12: saldo derivado soma quantidade × preço ativo a ativo', async () => {
  const user = await makeUser();

  const conta = await accountsService.create(user.id, {
    name: 'Corretora',
    type: 'investment',
    balance: 0,
    color: '#8b5cf6',
  });

  await prisma.investment.createMany({
    data: [
      {
        userId: user.id,
        accountId: conta.id,
        assetType: 'ACAO',
        name: 'Ativo A',
        ticker: `AAA${Math.floor(Math.random() * 900 + 100)}`,
        quantity: 10,
        averagePrice: 5,
        purchaseDate: new Date(),
      },
      {
        userId: user.id,
        accountId: conta.id,
        assetType: 'ACAO',
        name: 'Ativo B',
        ticker: `BBB${Math.floor(Math.random() * 900 + 100)}`,
        quantity: 1,
        averagePrice: 100,
        purchaseDate: new Date(),
      },
    ],
  });

  const { positionsValue } = await accountsService.getDerivedBalance(user.id, conta.id);
  // A fórmula antiga — Σquantidade × Σpreço — daria 11 × 105 = 1155.
  assert.equal(positionsValue, 150);
});

test('trocar a senha invalida os tokens anteriores', async () => {
  const email = `teste-${suffix()}@exemplo.test`;
  const { user, token: tokenAntigo } = await authService.register({
    email,
    password: 'senha-antiga-123',
    name: 'Troca de senha',
  });
  createdUserIds.push(user.id);

  const { token: tokenNovo } = await authService.changePassword(user.id, {
    currentPassword: 'senha-antiga-123',
    newPassword: 'senha-nova-4567',
  });

  const decodificaVersao = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url')).tv;
  assert.equal(decodificaVersao(tokenAntigo), 0);
  assert.equal(decodificaVersao(tokenNovo), 1, 'o token novo precisa carregar a versão incrementada');

  const salvo = await prisma.user.findUnique({
    where: { id: user.id },
    select: { tokenVersion: true },
  });
  assert.equal(salvo.tokenVersion, 1, 'o banco guarda a nova versão — tokens com tv=0 param de valer');
});

test('dados internos não vazam na resposta de autenticação', async () => {
  const user = await makeUser();
  const me = await authService.getMe(user.id);
  assert.equal(me.passwordHash, undefined);
  assert.equal(me.tokenVersion, undefined);
});

test('apresentação de primeiro uso: usuário novo não a viu ainda', async () => {
  const user = await makeUser();
  const me = await authService.getMe(user.id);
  assert.equal(me.onboardingCompletedAt, null, 'usuário recém-criado precisa ver a apresentação');
});

test('apresentação de primeiro uso: concluir grava a data e é idempotente', async () => {
  const user = await makeUser();

  const primeira = await authService.completeOnboarding(user.id);
  assert.ok(primeira.onboardingCompletedAt instanceof Date, 'a data precisa ser gravada');

  // Concluir de novo não pode reescrever quando o usuário viu pela primeira vez.
  const segunda = await authService.completeOnboarding(user.id);
  assert.equal(
    segunda.onboardingCompletedAt.getTime(),
    primeira.onboardingCompletedAt.getTime(),
    'a data original deve ser preservada',
  );

  const doBanco = await prisma.user.findUnique({
    where: { id: user.id },
    select: { onboardingCompletedAt: true },
  });
  assert.ok(doBanco.onboardingCompletedAt, 'persistido: a apresentação não volta no próximo login');
});

test('planejamento: mês de início é gravado como data absoluta', async () => {
  const user = await makeUser();
  const planningService = await import('../src/modules/planning/planning.service.js');

  const item = await planningService.create(user.id, {
    name: 'Décimo terceiro (1/2)',
    amount: 3200,
    type: 'income',
    dayOfMonth: 20,
    monthsDuration: 1,
    startDate: '2026-11',
  });

  assert.equal(item.startDate.getUTCFullYear(), 2026);
  assert.equal(item.startDate.getUTCMonth(), 10, 'novembro (índice 10)');
  assert.equal(item.startDate.getUTCDate(), 1, 'ancorado no primeiro dia do mês');
});

test('planejamento: sem mês informado, assume o mês corrente', async () => {
  const user = await makeUser();
  const planningService = await import('../src/modules/planning/planning.service.js');

  const item = await planningService.create(user.id, {
    name: 'Aluguel',
    amount: 1800,
    type: 'expense',
    dayOfMonth: 5,
  });

  const agora = new Date();
  assert.equal(item.startDate.getUTCFullYear(), agora.getUTCFullYear());
  assert.equal(item.startDate.getUTCMonth(), agora.getUTCMonth());
});

test('planejamento: editar preserva o mês escolhido', async () => {
  const user = await makeUser();
  const planningService = await import('../src/modules/planning/planning.service.js');

  const item = await planningService.create(user.id, {
    name: 'Férias',
    amount: 4000,
    type: 'income',
    dayOfMonth: 10,
    monthsDuration: 1,
    startDate: '2026-12',
  });

  const editado = await planningService.update(user.id, item.id, {
    name: 'Férias',
    amount: 4500,
    type: 'income',
    dayOfMonth: 10,
    monthsDuration: 1,
    startDate: '2026-12',
  });

  assert.equal(Number(editado.amount), 4500);
  assert.equal(editado.startDate.getUTCMonth(), 11, 'dezembro segue sendo dezembro');
});

test('conta de investimento traz o valor das posições em investedValue', async () => {
  const user = await makeUser();

  const corretora = await accountsService.create(user.id, {
    name: 'Corretora',
    type: 'investment',
    balance: 0,
    color: '#8b5cf6',
  });
  const corrente = await accountsService.create(user.id, {
    name: 'Corrente',
    type: 'checking',
    balance: 500,
    color: '#10b981',
  });

  await prisma.investment.createMany({
    data: [
      {
        userId: user.id,
        accountId: corretora.id,
        assetType: 'TESOURO_DIRETO',
        name: 'Tesouro IPCA 2050',
        ticker: `TD${Math.floor(Math.random() * 9000 + 1000)}`,
        quantity: 1.195,
        averagePrice: 800,
        currentPrice: 843.07,
        purchaseDate: new Date(),
      },
      {
        userId: user.id,
        accountId: corretora.id,
        assetType: 'ACAO',
        name: 'Ativo',
        ticker: `AC${Math.floor(Math.random() * 9000 + 1000)}`,
        quantity: 10,
        averagePrice: 20,
        currentPrice: null, // sem cotação: cai no preço médio
        purchaseDate: new Date(),
      },
    ],
  });

  const contas = await accountsService.list(user.id);
  const investimento = contas.find((c) => c.id === corretora.id);
  const checking = contas.find((c) => c.id === corrente.id);

  // 1,195 × 843,07 = 1007,47  +  10 × 20 = 200
  assert.equal(investimento.investedValue, 1207.47);
  assert.equal(Number(investimento.balance), 0, 'o campo balance continua zero');
  assert.equal(checking.investedValue, undefined, 'conta comum não ganha o campo');
});

test('sem conta de investimento, a listagem não muda', async () => {
  const user = await makeUser();
  await accountsService.create(user.id, {
    name: 'Só corrente',
    type: 'checking',
    balance: 100,
    color: '#10b981',
  });

  const contas = await accountsService.list(user.id);
  assert.equal(contas.length, 1);
  assert.equal(contas[0].investedValue, undefined);
});

test('excluir transação de investimento recalcula a posição', async () => {
  const user = await makeUser();
  const investmentsService = await import('../src/modules/investments/investments.service.js');

  const inv = await investmentsService.create(user.id, {
    assetType: 'ACAO',
    ticker: `PT${Math.floor(Math.random() * 9000 + 1000)}`,
    name: 'Petrobras',
    purchaseDate: '2026-01-15',
  });

  const tx = await investmentsService.createTransaction(user.id, inv.id, {
    type: 'APORTE',
    quantity: 100,
    unitPrice: 38.5,
    totalAmount: 3850,
    transactionDate: '2026-02-10',
  });

  const comPosicao = await investmentsService.getById(user.id, inv.id);
  assert.equal(Number(comPosicao.quantity), 100);
  assert.equal(Number(comPosicao.averagePrice), 38.5);

  await investmentsService.deleteTransaction(user.id, tx.id);

  const semPosicao = await investmentsService.getById(user.id, inv.id);
  assert.equal(Number(semPosicao.quantity), 0, 'quantidade zerada');
  assert.equal(semPosicao.isActive, false, 'ativo sai da carteira');
});

test('não dá para excluir transação de investimento de outro usuário', async () => {
  const dono = await makeUser();
  const invasor = await makeUser();
  const investmentsService = await import('../src/modules/investments/investments.service.js');

  const inv = await investmentsService.create(dono.id, {
    assetType: 'ACAO',
    ticker: `XX${Math.floor(Math.random() * 9000 + 1000)}`,
    name: 'Ativo do dono',
    purchaseDate: '2026-01-15',
  });
  const tx = await investmentsService.createTransaction(dono.id, inv.id, {
    type: 'APORTE',
    quantity: 10,
    unitPrice: 100,
    totalAmount: 1000,
    transactionDate: '2026-02-10',
  });

  await assert.rejects(
    () => investmentsService.deleteTransaction(invasor.id, tx.id),
    (err) => err.status === 404,
  );

  const intacto = await investmentsService.getById(dono.id, inv.id);
  assert.equal(Number(intacto.quantity), 10, 'a posição do dono não pode mudar');
});

test('Tesouro Direto: cadastro não exige taxa nem liquidez', async () => {
  const user = await makeUser();
  const investmentsService = await import('../src/modules/investments/investments.service.js');

  const inv = await investmentsService.create(user.id, {
    assetType: 'TESOURO_DIRETO',
    name: 'Tesouro IPCA+ 2050',
    indexer: 'IPCA',
    maturityDate: '2050-08-15',
    purchaseDate: '2026-09-03',
  });

  assert.equal(inv.interestRate, null, 'a taxa vem do aporte, não do cadastro');
  assert.equal(inv.liquidityDays, null, 'Tesouro tem liquidez diária — o campo não se aplica');
  assert.equal(inv.ticker, 'tesouro-ipca-15082050', 'o título é identificado por indexador + vencimento');
});

test('Tesouro Direto: liquidez informada é descartada', async () => {
  const user = await makeUser();
  const investmentsService = await import('../src/modules/investments/investments.service.js');

  const inv = await investmentsService.create(user.id, {
    assetType: 'TESOURO_DIRETO',
    name: 'Tesouro Selic 2029',
    indexer: 'SELIC',
    maturityDate: '2029-03-01',
    liquidityDays: 30,
    purchaseDate: '2026-09-03',
  });

  assert.equal(inv.liquidityDays, null);
});

test('renda fixa continua exigindo taxa no cadastro', async () => {
  const user = await makeUser();
  const investmentsService = await import('../src/modules/investments/investments.service.js');

  await assert.rejects(
    () =>
      investmentsService.create(user.id, {
        assetType: 'RENDA_FIXA',
        name: 'CDB Banco X',
        indexer: 'CDI',
        maturityDate: '2028-01-01',
        purchaseDate: '2026-09-03',
      }),
    (err) => err.status === 400 && /taxa/i.test(err.message),
    'sem API pública de taxa, o CDB precisa da taxa digitada',
  );
});

test('aporte em Tesouro: a taxa do aporte vira a taxa do ativo', async () => {
  const user = await makeUser();
  const investmentsService = await import('../src/modules/investments/investments.service.js');

  const inv = await investmentsService.create(user.id, {
    assetType: 'TESOURO_DIRETO',
    name: 'Tesouro IPCA+ 2050',
    indexer: 'IPCA',
    maturityDate: '2050-08-15',
    purchaseDate: '2026-09-03',
  });

  // R$ 105,72 aplicados a um PU de R$ 885,53 — como o formulário passa a calcular.
  await investmentsService.createTransaction(user.id, inv.id, {
    type: 'APORTE',
    quantity: 105.72 / 885.53,
    unitPrice: 885.53,
    totalAmount: 105.72,
    fees: 0,
    interestRate: 7.3,
    transactionDate: '2026-09-03',
  });

  const comPosicao = await investmentsService.getById(user.id, inv.id);
  assert.equal(Number(comPosicao.interestRate), 7.3, 'taxa do ativo = média das taxas dos aportes');
  assert.equal(Number(comPosicao.averagePrice), 885.53, 'preço médio = PU pago');

  const investido = Number(comPosicao.quantity) * Number(comPosicao.averagePrice);
  assert.ok(Math.abs(investido - 105.72) < 0.01, `investido deveria ser ~105,72, veio ${investido}`);
});

test('título do Tesouro escolhido na lista é respeitado', async () => {
  const user = await makeUser();
  const investmentsService = await import('../src/modules/investments/investments.service.js');

  // Mesmo vencimento, papéis diferentes: é a ambiguidade que a lista resolve.
  const semCupom = await investmentsService.create(user.id, {
    assetType: 'TESOURO_DIRETO',
    ticker: 'tesouro-ipca-15082050',
    name: 'Tesouro IPCA+ 2050',
    indexer: 'IPCA',
    maturityDate: '2050-08-15',
    purchaseDate: '2026-09-03',
  });

  const comCupom = await investmentsService.create(user.id, {
    assetType: 'TESOURO_DIRETO',
    ticker: 'tesouro-ipca-com-juros-semestrais-15082050',
    name: 'Tesouro IPCA+ com Juros Semestrais 2050',
    indexer: 'IPCA',
    maturityDate: '2050-08-15',
    purchaseDate: '2026-09-03',
  });

  assert.equal(semCupom.ticker, 'tesouro-ipca-15082050');
  assert.equal(comCupom.ticker, 'tesouro-ipca-com-juros-semestrais-15082050');
  assert.notEqual(
    Number(semCupom.currentPrice),
    Number(comCupom.currentPrice),
    'são papéis distintos e precisam ter PU distinto',
  );
});

test('corretora vem da conta vinculada, sem digitação', async () => {
  const user = await makeUser();
  const investmentsService = await import('../src/modules/investments/investments.service.js');

  const conta = await accountsService.create(user.id, {
    name: 'ION (Itaú)',
    type: 'investment',
    balance: 0,
    color: '#8b5cf6',
  });

  const inv = await investmentsService.create(user.id, {
    assetType: 'ACAO',
    ticker: `AB${Math.floor(Math.random() * 9000 + 1000)}`,
    name: 'Ativo',
    accountId: conta.id,
    purchaseDate: '2026-09-03',
  });

  assert.equal(inv.broker, 'ION (Itaú)', 'a conta de investimento é a corretora');
});

test('sem conta vinculada, a corretora digitada é preservada', async () => {
  const user = await makeUser();
  const investmentsService = await import('../src/modules/investments/investments.service.js');

  const inv = await investmentsService.create(user.id, {
    assetType: 'ACAO',
    ticker: `CD${Math.floor(Math.random() * 9000 + 1000)}`,
    name: 'Ativo solto',
    broker: 'XP',
    purchaseDate: '2026-09-03',
  });

  assert.equal(inv.broker, 'XP');
});
