import * as XLSX from 'xlsx';

const MONTHS_PT = {
  janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4,
  junho: 5, julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

function parseBrazilianMoney(valueText) {
  if (!valueText) return null;
  let s = String(valueText).replace(/\s/g, '').replace(/[R$]/g, '').replace('−', '-');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }

  const v = Number.parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

function parseDateDDMMYYYY(value) {
  const [day, month, year] = value.split('/').map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

function normalizeTypeByAmount(amount) {
  return amount >= 0 ? 'income' : 'expense';
}

function cleanDescription(text) {
  return text.replace(/\s+/g, ' ').trim();
}

export function inferBankByFilename(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes('itau')) return 'itau';
  if (lower.includes('picpay') || lower.includes('extrato-')) return 'picpay';
  if (lower.includes('btg')) return 'btg';
  return null;
}

/** Linha iniciada por data: deveria ser um lançamento. Serve para detectar descartes. */
const LOOKS_LIKE_ENTRY = /^\d{2}\/\d{2}\/\d{4}\s+\S/;

export function parseItauPdf(text) {
  const transactions = [];
  // Linhas com cara de lançamento que o regex não reconheceu. Sem esse contador
  // elas sumiriam em silêncio e o resumo da importação mentiria sobre o total lido.
  transactions.unrecognized = 0;

  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    // `−` (U+2212) além do hífen ASCII: PDFs usam o menos tipográfico com frequência,
    // e o parser do PicPay já o aceitava.
    const match = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([+\-−]?\d{1,3}(?:\.\d{3})*,\d{2})$/);
    if (!match) {
      if (LOOKS_LIKE_ENTRY.test(line) && !line.toUpperCase().includes('SALDO')) {
        transactions.unrecognized += 1;
      }
      continue;
    }
    const [, dateStr, rawDescription, amountText] = match;
    const description = cleanDescription(rawDescription);
    if (description.toUpperCase().includes('SALDO DO DIA')) continue;
    const amount = parseBrazilianMoney(amountText);
    if (amount === null) continue;
    transactions.push({
      date: parseDateDDMMYYYY(dateStr),
      description,
      amount: Math.abs(amount),
      type: normalizeTypeByAmount(amount),
      notes: 'Importado automaticamente (Itaú PDF)',
    });
  }
  return transactions;
}

export function parsePicpayPdf(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const transactions = [];
  let currentDate = null;

  for (const line of lines) {
    const dateMatch = line.match(/(\d{1,2}) de ([a-zçãé]+)\s+(\d{4})/i);
    if (dateMatch) {
      const day = Number(dateMatch[1]);
      const month = MONTHS_PT[dateMatch[2].toLowerCase()];
      const year = Number(dateMatch[3]);
      if (Number.isFinite(day) && month !== undefined && Number.isFinite(year)) {
        currentDate = new Date(year, month, day);
      }
      continue;
    }

    const txMatch = line.match(/^(\d{2}:\d{2})\s+(.+?)\s+([+\-−]R\$\s*\d{1,3}(?:\.\d{3})*,\d{2})(?:\s+.+)?$/i);
    if (!txMatch || !currentDate) continue;

    const [, time, kind, amountText] = txMatch;
    const amount = parseBrazilianMoney(amountText);
    if (amount === null) continue;

    transactions.push({
      date: new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate(),
        Number(time.split(':')[0]),
        Number(time.split(':')[1]),
      ),
      description: cleanDescription(kind),
      amount: Math.abs(amount),
      type: normalizeTypeByAmount(amount),
      notes: 'Importado automaticamente (PicPay PDF)',
    });
  }
  return transactions;
}

export function parseBtgXls(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
  const transactions = [];

  for (const row of rows) {
    if (!Array.isArray(row) || row.length === 0) continue;
    const cells = row.map((c) => String(c ?? '').trim());
    const dateTimeCell = cells[1] || '';
    const transactionCell = cells[3] || '';
    const descriptionCell = cells[6] || '';
    const amountCell = cells[10] || '';

    if (!/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}$/.test(dateTimeCell)) continue;
    if (!amountCell) continue;
    if ((descriptionCell || '').toLowerCase().includes('saldo diário')) continue;

    const [datePart, timePart] = dateTimeCell.split(' ');
    const baseDate = parseDateDDMMYYYY(datePart);
    if (!baseDate) continue;

    const [hours, minutes] = timePart.split(':').map(Number);
    const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes);
    const amount = parseBrazilianMoney(amountCell);
    if (amount === null || amount === 0) continue;

    transactions.push({
      date,
      description: cleanDescription(`${transactionCell} ${descriptionCell}`),
      amount: Math.abs(amount),
      type: normalizeTypeByAmount(amount),
      notes: 'Importado automaticamente (BTG XLS)',
    });
  }
  return transactions;
}
