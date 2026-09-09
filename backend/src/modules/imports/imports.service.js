import { PDFParse } from 'pdf-parse';
import { AppError } from '../../shared/utils/errors.js';
import * as repo from './imports.repository.js';
import { inferBankByFilename, parseItauPdf, parsePicpayPdf, parseBtgXls } from './imports.parsers.js';

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

function normalizeText(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTransferLike(description) {
  const n = normalizeText(description);
  return n.includes('pix') || n.includes('transf') || n.includes('transferencia') || n.includes('ted');
}

function findRuleMatch(rules, description) {
  const normalized = normalizeText(description);
  return rules.find((r) => r.enabled && r.matchType === 'contains' && normalized.includes(r.key)) || null;
}

function pickAutoCategory(description, type) {
  const normalized = normalizeText(description);
  return AUTO_CATEGORY_RULES.find((rule) => {
    if (rule.type && rule.type !== type) return false;
    return rule.keywords.some((k) => normalized.includes(normalizeText(k)));
  }) || null;
}

async function resolveCategory(categoryCache, tx, userId, learnedRule) {
  if (learnedRule) return learnedRule.categoryId;

  const autoMatch = pickAutoCategory(tx.description, tx.type);
  const { category: name, color, icon } = autoMatch || { category: 'Outros', color: '#78716c', icon: 'more' };
  const cacheKey = `${userId}:${tx.type}:${name}`;

  if (categoryCache.has(cacheKey)) return categoryCache.get(cacheKey);

  let cat = await repo.findCategory(name, tx.type, userId);
  if (!cat) {
    cat = await repo.createCategory({ name, type: tx.type, color: color || '#78716c', icon: icon || 'tag', userId });
  }

  categoryCache.set(cacheKey, cat.id);
  return cat.id;
}

async function tryMarkInternalTransferPair(tx, userId) {
  if (!isTransferLike(tx.description)) return;
  const candidates = await repo.findTransferCandidates(userId, tx);
  const match = candidates.find((c) => isTransferLike(c.description));
  if (!match) return;
  await repo.markInternalTransfer([tx.id, match.id]);
}

async function parseFile(file, bankHint) {
  const ext = file.originalname.toLowerCase();

  if (ext.endsWith('.pdf')) {
    const parser = new PDFParse({ data: file.buffer });
    const data = await parser.getText();
    await parser.destroy();
    const text = data.text || '';
    if (bankHint === 'itau') return parseItauPdf(text);
    if (bankHint === 'picpay') return parsePicpayPdf(text);
    const itauTry = parseItauPdf(text);
    return itauTry.length > 0 ? itauTry : parsePicpayPdf(text);
  }

  if (ext.endsWith('.xls') || ext.endsWith('.xlsx')) {
    return parseBtgXls(file.buffer);
  }

  throw new AppError('Formato não suportado. Envie PDF ou XLS.', 400);
}

export async function importStatement(userId, file, accountId) {
  if (!file) throw new AppError('Arquivo não enviado', 400);
  if (!accountId) throw new AppError('Selecione uma conta para importação', 400);

  const account = await repo.findAccount(accountId, userId);
  if (!account) throw new AppError('Conta inválida', 400);

  const bankHint = inferBankByFilename(file.originalname);
  const parsed = await parseFile(file, bankHint);
  const valid = parsed.filter((tx) => tx.date instanceof Date && !Number.isNaN(tx.date.getTime()));

  if (valid.length === 0) throw new AppError('Nenhuma transação válida encontrada no arquivo', 400);

  const batch = await repo.createBatch({ filename: file.originalname, bank: bankHint, accountId, userId });

  const merchantRules = {
    income: await repo.loadMerchantRules('income', userId),
    expense: await repo.loadMerchantRules('expense', userId),
  };

  const categoryCache = new Map();
  const occurrenceCounter = new Map();
  const createdIds = [];

  for (const tx of valid) {
    const sig = [accountId, tx.type, tx.amount.toFixed(2), tx.date.toISOString(), normalizeText(tx.description)].join('|');
    const occurrence = (occurrenceCounter.get(sig) || 0) + 1;
    occurrenceCounter.set(sig, occurrence);

    const existingCount = await repo.countDuplicates(userId, accountId, tx);
    if (existingCount >= occurrence) continue;

    const learnedRule = findRuleMatch(merchantRules[tx.type] || [], tx.description);
    const categoryId = await resolveCategory(categoryCache, tx, userId, learnedRule);

    const created = await repo.createTransaction({
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      date: tx.date,
      categoryId,
      accountId,
      importBatchId: batch.id,
      notes: tx.notes,
      userId,
    });

    createdIds.push(created.id);
    await tryMarkInternalTransferPair(created, userId);

    const delta = tx.type === 'income' ? tx.amount : -tx.amount;
    await repo.adjustAccountBalance(accountId, delta);
  }

  return {
    imported: createdIds.length,
    parsed: valid.length,
    skipped: valid.length - createdIds.length,
    // Linhas que pareciam lançamento mas o parser não entendeu. Reportar é melhor
    // que descartar em silêncio — o usuário precisa saber que faltou algo.
    unrecognized: parsed.unrecognized || 0,
    accountId,
    importBatchId: batch.id,
    filename: batch.filename,
  };
}

export function listBatches(userId, accountId) {
  return repo.findBatches(userId, accountId);
}

export async function deleteBatch(userId, id) {
  const batch = await repo.findBatchById(id, userId);
  if (!batch) throw new AppError('ImportBatch não encontrado', 404);

  const deleted = await repo.deleteBatchTransactions(id);
  await repo.deleteBatch(id);
  await repo.recomputeAccountBalances(userId);

  return {
    deletedTransactions: deleted.count,
    importBatchId: id,
    note: 'Importação removida. Saldos recalculados.',
  };
}

// Merchant rules
function normalizeForRule(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const KNOWN_MERCHANTS = ['uber', 'ifood', 'shopee', 'mercado livre', 'mercadolivre', 'mercado pago', 'amazon', 'netflix', 'spotify', 'apple', 'google'];

function extractMerchantKey(description) {
  const n = normalizeForRule(description);
  for (const k of KNOWN_MERCHANTS) {
    if (n.includes(k)) return k;
  }
  const cleaned = n
    .replace(/\b(pix|qrs|transferencia|transferencia enviada|transferencia recebida|pagamento|compra|debito|credito)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return cleaned.length >= 4 ? cleaned.slice(0, 32).trim() : n.slice(0, 32).trim();
}

import prisma from '../../shared/lib/prisma.js';

export async function applyRuleFromTransaction(userId, transactionId, { categoryId, scope }) {
  if (!categoryId) throw new AppError('categoryId é obrigatório', 400);

  const transaction = await prisma.transaction.findFirst({ where: { id: transactionId, userId } });
  if (!transaction) throw new AppError('Transação não encontrada', 404);

  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) throw new AppError('Categoria inválida', 400);

  if (category.type !== transaction.type) {
    throw new AppError('Categoria não é compatível com o tipo da transação', 400);
  }

  const key = extractMerchantKey(transaction.description);
  if (!key) throw new AppError('Não foi possível extrair uma chave de destino', 400);

  const normalizedKey = normalizeForRule(key);

  const rule = await prisma.merchantRule.upsert({
    where: { userId_key_matchType_type: { userId, key: normalizedKey, matchType: 'contains', type: transaction.type } },
    update: { categoryId, enabled: true },
    create: { key: normalizedKey, matchType: 'contains', type: transaction.type, categoryId, enabled: true, userId },
  });

  const whereBase = { type: transaction.type, userId };
  if (scope === 'account' && transaction.accountId) whereBase.accountId = transaction.accountId;

  const candidates = await prisma.transaction.findMany({ where: whereBase, select: { id: true, description: true } });
  const matchedIds = candidates.filter((t) => normalizeForRule(t.description).includes(rule.key)).map((t) => t.id);

  const updated = matchedIds.length
    ? await prisma.transaction.updateMany({ where: { id: { in: matchedIds } }, data: { categoryId } })
    : { count: 0 };

  return {
    ruleId: rule.id, key: rule.key, updatedCount: updated.count,
    scope: scope || 'all',
    note: 'Regra salva. As próximas importações também usarão essa regra.',
  };
}
