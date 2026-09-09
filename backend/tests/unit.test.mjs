import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAveragePrice,
  calculateProfitability,
  calculateAverageInterestRate,
} from '../src/utils/investmentCalculations.js';
import { parseItauPdf, parsePicpayPdf, inferBankByFilename } from '../src/modules/imports/imports.parsers.js';

test('preço médio: dois aportes ponderados', () => {
  const { quantity, averagePrice } = calculateAveragePrice([
    { type: 'APORTE', quantity: 10, unitPrice: 20, fees: 0, transactionDate: '2024-01-01' },
    { type: 'APORTE', quantity: 10, unitPrice: 30, fees: 0, transactionDate: '2024-02-01' },
  ]);
  assert.equal(quantity, 20);
  assert.equal(averagePrice, 25);
});

test('preço médio: resgate mantém preço médio', () => {
  const { quantity, averagePrice } = calculateAveragePrice([
    { type: 'APORTE', quantity: 10, unitPrice: 20, fees: 0, transactionDate: '2024-01-01' },
    { type: 'RESGATE', quantity: 4, unitPrice: 50, fees: 0, transactionDate: '2024-02-01' },
  ]);
  assert.equal(quantity, 6);
  assert.equal(averagePrice, 20);
});

test('preço médio: taxas entram no custo', () => {
  const { averagePrice } = calculateAveragePrice([
    { type: 'APORTE', quantity: 10, unitPrice: 20, fees: 10, transactionDate: '2024-01-01' },
  ]);
  assert.equal(averagePrice, 21);
});

test('rentabilidade: 20 -> 25 = +25%', () => {
  const r = calculateProfitability({ quantity: 10, averagePrice: 20 }, 25);
  assert.equal(r.absoluteGain, 50);
  assert.equal(r.percentageGain, 25);
});

test('taxa média ponderada por quantidade', () => {
  const rate = calculateAverageInterestRate([
    { type: 'APORTE', quantity: 1, interestRate: 7.10, transactionDate: '2024-01-01' },
    { type: 'APORTE', quantity: 3, interestRate: 7.30, transactionDate: '2024-02-01' },
  ]);
  assert.equal(rate, 7.25);
});

test('Itau PDF: linha padrao com sinal negativo ASCII', () => {
  const txs = parseItauPdf('05/01/2024   PIX ENVIADO JOAO   -1.234,56');
  assert.equal(txs.length, 1);
  assert.equal(txs[0].amount, 1234.56);
  assert.equal(txs[0].type, 'expense');
});

test('Itau PDF: ignora SALDO DO DIA', () => {
  assert.equal(parseItauPdf('05/01/2024   SALDO DO DIA   1.000,00').length, 0);
});

test('PicPay PDF: data em portugues + linha de transacao', () => {
  const txt = ['12 de março 2024', '14:30   Pagamento iFood   −R$ 45,90'].join('\n');
  const txs = parsePicpayPdf(txt);
  assert.equal(txs.length, 1);
  assert.equal(txs[0].amount, 45.90);
  assert.equal(txs[0].type, 'expense');
});

test('inferBankByFilename', () => {
  assert.equal(inferBankByFilename('extrato-itau-jan.pdf'), 'itau');
  assert.equal(inferBankByFilename('BTG_2024.xlsx'), 'btg');
  assert.equal(inferBankByFilename('relatorio.pdf'), null);
});

/**
 * Decomposição do resultado de um título público, como o painel
 * TreasuryResultBreakdown apresenta na tela.
 *
 * A posição é marcada pelo PU de venda, mas foi comprada pelo PU de compra. Sem separar
 * o efeito da taxa do custo de saída, o resultado parece contradizer a taxa travada.
 */
function decomporResultado({ pagoPU, puCompraHoje, puVendaHoje }) {
  const valorizacao = puCompraHoje / pagoPU - 1;
  const custoDeSaida = puVendaHoje / puCompraHoje - 1;
  const total = puVendaHoje / pagoPU - 1;
  return { valorizacao, custoDeSaida, total };
}

test('resultado de título público = valorização × custo de saída', () => {
  const r = decomporResultado({ pagoPU: 881.53, puCompraHoje: 885.53, puVendaHoje: 862.12 });

  assert.ok(r.valorizacao > 0, 'taxa caiu de 7,36% para 7,30%: o título valorizou');
  assert.ok(r.custoDeSaida < 0, 'vender custa o spread entre os dois lados');
  assert.ok(r.total < 0, 'o total fica negativo mesmo com o título valorizando');

  const composto = (1 + r.valorizacao) * (1 + r.custoDeSaida) - 1;
  assert.ok(
    Math.abs(composto - r.total) < 1e-12,
    'a decomposição precisa reconstruir o total exatamente',
  );
});

test('sem spread, o resultado é só a valorização', () => {
  const r = decomporResultado({ pagoPU: 881.53, puCompraHoje: 885.53, puVendaHoje: 885.53 });
  assert.equal(r.custoDeSaida, 0);
  assert.ok(Math.abs(r.total - r.valorizacao) < 1e-12);
});

test('taxa subindo derruba o preço do título', () => {
  // Comprou a 7,00% e hoje o mercado compra a 7,50%: PU cai.
  const r = decomporResultado({ pagoPU: 900, puCompraHoje: 870, puVendaHoje: 850 });
  assert.ok(r.valorizacao < 0, 'taxa maior hoje significa preço menor');
  assert.ok(r.total < r.valorizacao, 'e o custo de saída piora ainda mais');
});
