import test from 'node:test';
import assert from 'node:assert/strict';

// Réplica de addMonthsClamped, de goals.service.js (buildInstallments).
function paymentDateFromSource(startDate, i) {
  const target = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
  const lastDayOfTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(startDate.getDate(), lastDayOfTargetMonth));
  return target;
}

test('meta iniciada em 31/01 gera parcelas nos meses corretos', () => {
  const start = new Date(2025, 0, 31); // 31 jan 2025
  const meses = [0, 1, 2, 3].map((i) => {
    const d = paymentDateFromSource(start, i);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth() + 1).padStart(2,'0')}`;
  });
  assert.deepEqual(meses, ['31/01', '28/02', '31/03', '30/04'], `parcelas geradas: ${meses.join(' ')}`);
});

test('meta iniciada em 31/05 nao pula junho', () => {
  const start = new Date(2025, 4, 31); // 31 mai
  const d = paymentDateFromSource(start, 1);
  assert.equal(d.getMonth(), 5, `parcela 2 caiu no mes ${d.getMonth() + 1} (esperado 6/junho): ${d.toLocaleDateString('pt-BR')}`);
});

// monthLabel de goals.service.js: formatMonthLabel(paymentDate)
test('monthLabel distingue anos diferentes', () => {
  const fmt = (d) => d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const a = fmt(new Date(2025, 0, 15));
  const b = fmt(new Date(2026, 0, 15));
  assert.notEqual(a, b, `mes 1 e mes 13 exibem o mesmo rotulo: "${a}"`);
});

// --- Regressao dos parsers -----------------------------------------------

import { parseItauPdf } from '../src/modules/imports/imports.parsers.js';

test('parser do Itau aceita o menos tipografico (U+2212)', () => {
  const txs = parseItauPdf('05/01/2024   COMPRA CARTAO   −1.234,56');
  assert.equal(txs.length, 1, 'linha descartada silenciosamente: o regex aceita apenas [+-] ASCII');
});
