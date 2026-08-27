function normalizeText(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMerchantKey(description) {
  const n = normalizeText(description);

  const known = [
    'uber',
    'ifood',
    'shopee',
    'mercado livre',
    'mercadolivre',
    'mercado pago',
    'amazon',
    'netflix',
    'spotify',
    'apple',
    'google',
  ];

  for (const k of known) {
    if (n.includes(k)) return k;
  }

  // Remove termos genéricos comuns de extratos
  const cleaned = n
    .replace(/\b(pix|qrs|transferencia|transferencia enviada|transferencia recebida|pagamento|compra|debito|credito)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Evita chave muito curta; pega início como aproximação (bom o bastante para "mesmo destino")
  return cleaned.length >= 4 ? cleaned.slice(0, 32).trim() : n.slice(0, 32).trim();
}

export const applyRuleFromTransaction = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId, scope } = req.body || {};

    if (!categoryId) return res.status(400).json({ error: 'categoryId é obrigatório' });

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!transaction) return res.status(404).json({ error: 'Transação não encontrada' });

    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId: req.user.id },
    });
    if (!category) return res.status(400).json({ error: 'Categoria inválida' });

    // Regra deve respeitar tipo (income/expense)
    if (category.type !== transaction.type) {
      return res.status(400).json({ error: 'Categoria não é compatível com o tipo da transação' });
    }

    const key = extractMerchantKey(transaction.description);
    if (!key) return res.status(400).json({ error: 'Não foi possível extrair uma chave de destino' });

    const rule = await prisma.merchantRule.upsert({
      where: {
        userId_key_matchType_type: {
          userId: req.user.id,
          key: normalizeText(key),
          matchType: 'contains',
          type: transaction.type,
        },
      },
      update: {
        categoryId,
        enabled: true,
      },
      create: {
        key: normalizeText(key),
        matchType: 'contains',
        type: transaction.type,
        categoryId,
        enabled: true,
        userId: req.user.id,
      },
    });

    // Reaplica em transações já existentes
    const whereBase = { type: transaction.type, userId: req.user.id };
    if (scope === 'account' && transaction.accountId) whereBase.accountId = transaction.accountId;

    // Busca candidatos e filtra via normalização (case/acentos/números).
    const candidates = await prisma.transaction.findMany({
      where: whereBase,
      select: { id: true, description: true },
    });

    const matchedIds = candidates
      .filter((t) => normalizeText(t.description).includes(rule.key))
      .map((t) => t.id);

    const updated = matchedIds.length
      ? await prisma.transaction.updateMany({
          where: { id: { in: matchedIds } },
          data: { categoryId },
        })
      : { count: 0 };

    return res.json({
      ruleId: rule.id,
      key: rule.key,
      updatedCount: updated.count,
      scope: scope || 'all',
      note: 'Regra salva. As próximas importações também usarão essa regra.',
      debug: { candidates: candidates.length, matched: matchedIds.length },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};