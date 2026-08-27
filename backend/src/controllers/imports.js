import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';

const MONTHS_PT = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  março: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

const AUTO_CATEGORY_RULES = [
  { keywords: ['uber', '99 tecnologia', '99 food', 'cabify', 'metro', 'onibus'], category: 'Transporte', icon: 'car', color: '#f97316' },
  { keywords: ['ifood', 'rappi', 'ubereats', 'restaurante', 'lanchonete', 'pizzaria'], category: 'Alimentação', icon: 'utensils', color: '#ef4444' },
  { keywords: ['mercado livre', 'mercadolivre', 'mercado pago', 'shopee', 'amazon', 'magalu', 'americanas'], category: 'Compras Online', icon: 'shopping-bag', color: '#a855f7' },
  { keywords: ['supermercado', 'atacadao', 'carrefour', 'extra', 'pao de acucar', 'assai'], category: 'Mercado', icon: 'shopping-cart', color: '#f59e0b' },
  { keywords: ['farmacia', 'drogaria', 'droga', 'raia', 'drogasil'], category: 'Saúde', icon: 'heart', color: '#22c55e' },
  { keywords: ['netflix', 'spotify', 'youtube', 'prime video', 'disney', 'max'], category: 'Assinaturas', icon: 'tv', color: '#8b5cf6' },
  { keywords: ['apple.com/bill', 'google', 'microsoft', 'steam'], category: 'Tecnologia', icon: 'laptop', color: '#3b82f6' },
  { keywords: ['energia', 'enel', 'sabesp', 'vivo', 'tim', 'claro', 'telefonica'], category: 'Moradia', icon: 'home', color: '#eab308' },
  { keywords: ['salario', 'remuneracao', 'tef credito salario', 'credito consignado'], category: 'Salário', icon: 'briefcase', color: '#10b981', type: 'income' },
  { keywords: ['rendimento', 'rend pago', 'cdi', 'investimento'], category: 'Investimentos', icon: 'trending-up', color: '#f59e0b', type: 'income' },
  { keywords: ['pix recebido', 'ted recebida', 'transferencia recebida'], category: 'Transferências Recebidas', icon: 'arrow-down', color: '#14b8a6', type: 'income' },
  { keywords: ['pix enviado', 'ted enviada', 'transferencia enviada'], category: 'Transferências Enviadas', icon: 'arrow-up', color: '#6366f1' },
];

function parseBrazilianMoney(valueText) {
  if (!valueText) return null;
  let normalized = String(valueText)
    .replace(/\s/g, '')
    .replace(/[R$]/g, '')
    .replace('−', '-');

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    // Detect decimal separator by the last punctuation char.
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
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

function normalizeText(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function txSignature(accountId, tx) {
  return [
    accountId,
    tx.type,
    tx.amount.toFixed(2),
    tx.date.toISOString(),
    normalizeText(tx.description),
  ].join('|');
}

function isTransferLike(description) {
  const n = normalizeText(description);
  return n.includes('pix') || n.includes('transf') || n.includes('transferencia') || n.includes('ted');
}

async function tryMarkInternalTransferPair(prisma, transaction, userId) {
  if (!isTransferLike(transaction.description)) return;
  const oppositeType = transaction.type === 'income' ? 'expense' : 'income';
  const start = new Date(transaction.date.getTime() - 24 * 60 * 60 * 1000);
  const end = new Date(transaction.date.getTime() + 24 * 60 * 60 * 1000);

  const candidates = await prisma.transaction.findMany({
    where: {
      userId,
      type: oppositeType,
      amount: transaction.amount,
      internalTransfer: false,
      accountId: { not: transaction.accountId || undefined },
      date: { gte: start, lte: end },
    },
    select: { id: true, description: true },
    take: 20,
  });

  const match = candidates.find((c) => isTransferLike(c.description));
  if (!match) return;

  await prisma.transaction.updateMany({
    where: { id: { in: [transaction.id, match.id] } },
    data: { internalTransfer: true },
  });
}

async function loadMerchantRules(prisma, type, userId) {
  // Regras específicas do tipo + regras globais (type null)
  return prisma.merchantRule.findMany({
    where: {
      userId,
      enabled: true,
      OR: [{ type: null }, { type }],
    },
    include: { category: true },
  });
}

function findRuleMatch(rules, description) {
  const normalized = normalizeText(description);
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.matchType !== 'contains') continue;
    if (normalized.includes(rule.key)) return rule;
  }
  return null;
}

function pickAutoCategory(description, type) {
  const normalized = normalizeText(description);
  for (const rule of AUTO_CATEGORY_RULES) {
    if (rule.type && rule.type !== type) continue;
    if (rule.keywords.some((keyword) => normalized.includes(normalizeText(keyword)))) {
      return rule;
    }
  }
  return null;
}

async function getOrCreateCategory(prisma, cache, type, name, color, icon, userId) {
  const key = `${userId}:${type}:${name}`;
  if (cache.has(key)) return cache.get(key);

  let category = await prisma.category.findFirst({
    where: { name, type, userId },
  });

  if (!category) {
    category = await prisma.category.create({
      data: {
        name,
        type,
        color: color || '#78716c',
        icon: icon || 'tag',
        userId,
      },
    });
  }

  cache.set(key, category.id);
  return category.id;
}

function parseItauPdf(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const transactions = [];

  for (const line of lines) {
    const match = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([+-]?\d{1,3}(?:\.\d{3})*,\d{2})$/);
    if (!match) continue;

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

function parsePicpayDateLine(line) {
  const match = line.match(/(\d{1,2}) de ([a-zçãé]+)\s+(\d{4})/i);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS_PT[match[2].toLowerCase()];
  const year = Number(match[3]);
  if (!Number.isFinite(day) || month === undefined || !Number.isFinite(year)) return null;
  return new Date(year, month, day);
}

function parsePicpayPdf(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const transactions = [];
  let currentDate = null;

  for (const line of lines) {
    const dateFromLine = parsePicpayDateLine(line);
    if (dateFromLine) {
      currentDate = dateFromLine;
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

function parseBtgXls(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
  const transactions = [];

  for (const row of rows) {
    if (!Array.isArray(row) || row.length === 0) continue;
    const cells = row.map((cell) => String(cell ?? '').trim());
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

function inferBankByFilename(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes('itau')) return 'itau';
  if (lower.includes('picpay') || lower.includes('extrato-')) return 'picpay';
  if (lower.includes('btg')) return 'btg';
  return null;
}

export const importStatement = (prisma) => async (req, res) => {
  try {
    const accountId = req.body.accountId || null;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Arquivo não enviado' });
    }

    if (!accountId) {
      return res.status(400).json({ error: 'Selecione uma conta para importação' });
    }

    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: req.user.id },
    });
    if (!account) {
      return res.status(400).json({ error: 'Conta inválida' });
    }

    const bankHint = inferBankByFilename(file.originalname);
    let parsed = [];

    if (file.originalname.toLowerCase().endsWith('.pdf')) {
      const parser = new PDFParse({ data: file.buffer });
      const data = await parser.getText();
      await parser.destroy();
      const text = data.text || '';
      if (bankHint === 'itau') {
        parsed = parseItauPdf(text);
      } else if (bankHint === 'picpay') {
        parsed = parsePicpayPdf(text);
      } else {
        const itauTry = parseItauPdf(text);
        parsed = itauTry.length > 0 ? itauTry : parsePicpayPdf(text);
      }
    } else if (file.originalname.toLowerCase().endsWith('.xls') || file.originalname.toLowerCase().endsWith('.xlsx')) {
      parsed = parseBtgXls(file.buffer);
    } else {
      return res.status(400).json({ error: 'Formato não suportado. Envie PDF ou XLS.' });
    }

    const validTransactions = parsed.filter((tx) => tx.date instanceof Date && !Number.isNaN(tx.date.getTime()));

    if (validTransactions.length === 0) {
      return res.status(400).json({ error: 'Nenhuma transação válida encontrada no arquivo' });
    }

    const importBatch = await prisma.importBatch.create({
      data: {
        filename: file.originalname,
        bank: bankHint,
        accountId,
        userId: req.user.id,
      },
    });

    const createdIds = [];
    const incomingOccurrenceCounter = new Map();
    const categoryCache = new Map();
    const merchantRulesByType = {
      income: await loadMerchantRules(prisma, 'income', req.user.id),
      expense: await loadMerchantRules(prisma, 'expense', req.user.id),
    };

    for (const tx of validTransactions) {
      const signature = txSignature(accountId, tx);
      const currentOccurrence = (incomingOccurrenceCounter.get(signature) || 0) + 1;
      incomingOccurrenceCounter.set(signature, currentOccurrence);

      const existingCount = await prisma.transaction.count({
        where: {
          userId: req.user.id,
          accountId,
          date: tx.date,
          amount: tx.amount,
          type: tx.type,
          description: tx.description,
        },
      });

      // Deduplicação por ocorrência: evita remover transações legítimas iguais no mesmo dia.
      if (existingCount >= currentOccurrence) continue;

      const learnedRule = findRuleMatch(merchantRulesByType[tx.type] || [], tx.description);
      const matchedRule = learnedRule ? null : pickAutoCategory(tx.description, tx.type);
      let categoryId = null;
      if (learnedRule) {
        categoryId = learnedRule.categoryId;
      } else if (matchedRule) {
        categoryId = await getOrCreateCategory(
          prisma,
          categoryCache,
          tx.type,
          matchedRule.category,
          matchedRule.color,
          matchedRule.icon,
          req.user.id,
        );
      } else {
        categoryId = await getOrCreateCategory(prisma, categoryCache, tx.type, 'Outros', '#78716c', 'more', req.user.id);
      }

      const created = await prisma.transaction.create({
        data: {
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          date: tx.date,
          categoryId,
          accountId,
          importBatchId: importBatch.id,
          notes: tx.notes,
          userId: req.user.id,
        },
      });

      createdIds.push(created.id);

      await tryMarkInternalTransferPair(prisma, created, req.user.id);

      const balanceChange = tx.type === 'income' ? tx.amount : -tx.amount;
      await prisma.account.update({
        where: { id: accountId },
        data: { balance: { increment: balanceChange } },
      });
    }

    return res.json({
      imported: createdIds.length,
      parsed: validTransactions.length,
      skipped: validTransactions.length - createdIds.length,
      accountId,
      importBatchId: importBatch.id,
      filename: importBatch.filename,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};