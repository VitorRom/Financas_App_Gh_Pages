/**
 * A janela de atividade de um item de planejamento é absoluta.
 *
 * O bug original: `startMonth` guardava um deslocamento em meses contado a partir
 * de "hoje". Como "hoje" muda, um item marcado para novembro virava dezembro na
 * virada do mês, e um parcelamento nunca terminava. Estes testes replicam a
 * lógica de Planning.jsx e travam o comportamento correto.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const ym = (ano, mes) => ano * 12 + (mes - 1);

/** Réplica de itemWindow + isItemActiveInMonth de frontend/src/pages/Planning.jsx */
function ativoNoMes(item, mesAbsoluto) {
  if (item.enabled === false) return false;
  const start = item.startDate == null ? null : item.startDate;
  if (start == null) return true;
  if (mesAbsoluto < start) return false;
  const end = item.monthsDuration == null ? null : start + item.monthsDuration;
  return end == null || mesAbsoluto < end;
}

test('décimo terceiro fica em novembro, independente do mês em que se olha', () => {
  const decimoTerceiro = { startDate: ym(2026, 11), monthsDuration: 1 };

  assert.equal(ativoNoMes(decimoTerceiro, ym(2026, 11)), true, 'aparece em novembro');

  // O ponto do bug: olhar em outro mês não pode mover o item.
  for (const [ano, mes] of [[2026, 9], [2026, 10], [2026, 12], [2027, 1]]) {
    assert.equal(
      ativoNoMes(decimoTerceiro, ym(ano, mes)),
      false,
      `não pode aparecer em ${mes}/${ano}`,
    );
  }
});

test('parcelamento de 9 meses termina — não empurra para frente', () => {
  const emprestimo = { startDate: ym(2026, 9), monthsDuration: 9 };

  assert.equal(ativoNoMes(emprestimo, ym(2026, 9)), true, 'primeira parcela em setembro');
  assert.equal(ativoNoMes(emprestimo, ym(2027, 5)), true, 'nona parcela em maio de 2027');
  assert.equal(ativoNoMes(emprestimo, ym(2027, 6)), false, 'em junho de 2027 já acabou');

  const parcelas = [];
  for (let m = ym(2026, 1); m <= ym(2028, 12); m++) {
    if (ativoNoMes(emprestimo, m)) parcelas.push(m);
  }
  assert.equal(parcelas.length, 9, 'exatamente 9 parcelas ao longo de 3 anos');
});

test('item vitalício vale de qualquer mês a partir do início', () => {
  const salario = { startDate: ym(2026, 8), monthsDuration: null };
  assert.equal(ativoNoMes(salario, ym(2026, 7)), false, 'antes do início, não');
  assert.equal(ativoNoMes(salario, ym(2026, 8)), true);
  assert.equal(ativoNoMes(salario, ym(2030, 3)), true, 'segue valendo anos depois');
});

test('item sem mês de início (dado antigo) permanece sempre ativo', () => {
  const antigo = { startDate: null, monthsDuration: null };
  assert.equal(ativoNoMes(antigo, ym(2026, 1)), true);
  assert.equal(ativoNoMes(antigo, ym(2027, 12)), true);
});

test('a virada de mês não desloca nada', () => {
  const ferias = { startDate: ym(2026, 12), monthsDuration: 1 };

  // Simula olhar a mesma projeção em meses diferentes: a janela é a mesma sempre.
  const janelasVistasDeVariosMeses = [ym(2026, 8), ym(2026, 9), ym(2026, 10)].map((hoje) => {
    const visiveis = [];
    for (let i = 0; i < 12; i++) {
      const mes = hoje + i;
      if (ativoNoMes(ferias, mes)) visiveis.push(mes);
    }
    return visiveis;
  });

  for (const janela of janelasVistasDeVariosMeses) {
    assert.deepEqual(janela, [ym(2026, 12)], 'férias caem em dezembro de 2026, sempre');
  }
});

/**
 * Réplica de itemStartMonthIndex de Planning.jsx: `startDate` manda, e na ausência
 * dele o mês é reconstruído de `createdAt + startMonth`.
 */
function inicioDoItem(item) {
  if (item.startDate != null) return item.startDate;
  if (item.createdAt) {
    const c = new Date(item.createdAt);
    if (!Number.isNaN(c.getTime())) {
      return c.getUTCFullYear() * 12 + c.getUTCMonth() + (item.startMonth ?? 0);
    }
  }
  return null;
}

test('sem startDate, o mês é reconstruído de createdAt + startMonth', () => {
  // É o que uma API desatualizada devolve: só o deslocamento relativo.
  const daApiAntiga = { createdAt: '2026-08-24T12:00:00.000Z', startMonth: 3, monthsDuration: 1 };

  assert.equal(inicioDoItem(daApiAntiga), ym(2026, 11), 'agosto + 3 = novembro');

  const item = { startDate: inicioDoItem(daApiAntiga), monthsDuration: 1 };
  assert.equal(ativoNoMes(item, ym(2026, 11)), true);
  assert.equal(ativoNoMes(item, ym(2026, 9)), false, 'não pode vazar para setembro');
  assert.equal(ativoNoMes(item, ym(2026, 12)), false);
});

test('startDate tem precedência sobre startMonth quando ambos vêm', () => {
  const misto = {
    startDate: ym(2026, 11),
    createdAt: '2026-08-24T12:00:00.000Z',
    startMonth: 99,
  };
  assert.equal(inicioDoItem(misto), ym(2026, 11), 'o campo absoluto vence');
});
