import { getTreasuryQuote, searchTreasury } from '../services/tesouroTransparente.js';

const INDEXER_SLUG = {
  IPCA: 'ipca',
  SELIC: 'selic',
  PRE: 'prefixado',
  IGPM: 'igpm',
  CDI: 'prefixado',
  NONE: 'prefixado',
};

function toIsoDate(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function maturityToSuffix(maturityDate) {
  const iso = toIsoDate(maturityDate);
  if (!iso) return null;
  const [, yyyy, mm, dd] = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
  if (!yyyy) return null;
  return `${dd}${mm}${yyyy}`;
}

export function buildTreasurySymbol({ indexer, maturityDate, name }) {
  const suffix = maturityToSuffix(maturityDate);
  if (!suffix) return null;

  const slug = INDEXER_SLUG[indexer] || 'ipca';
  const n = (name || '').toLowerCase();
  if (n.includes('juros semestrais')) {
    return `tesouro-${slug}-com-juros-semestrais-${suffix}`;
  }
  return `tesouro-${slug}-${suffix}`;
}

async function quoteExists(symbol) {
  const quote = await getTreasuryQuote(symbol);
  return quote && !quote.error && quote.price != null;
}

/**
 * Resolve o symbol oficial do Tesouro (ex: tesouro-ipca-15082050) a partir
 * do ticker salvo ou dos metadados do investimento (indexador + vencimento + nome).
 */
export async function resolveTreasuryTicker(investment) {
  const saved = investment.ticker?.trim().toLowerCase();
  if (saved) {
    if (await quoteExists(saved)) return saved;
  }

  const maturityISO = toIsoDate(investment.maturityDate);
  if (!maturityISO) return saved || null;

  const candidates = [];
  const plain = buildTreasurySymbol({
    indexer: investment.indexer,
    maturityDate: maturityISO,
    name: '',
  });
  const named = buildTreasurySymbol({
    indexer: investment.indexer,
    maturityDate: maturityISO,
    name: investment.name,
  });

  for (const sym of [named, plain]) {
    if (sym && !candidates.includes(sym)) candidates.push(sym);
  }

  for (const sym of candidates) {
    if (await quoteExists(sym)) return sym;
  }

  const query = investment.name
    || `${investment.indexer || 'IPCA'} ${maturityISO.slice(0, 4)}`;
  const results = await searchTreasury(query);
  const exact = results.find((r) => r.maturityDate === maturityISO);
  if (exact?.ticker) return exact.ticker;

  return candidates[0] || saved || null;
}

export function quoteReferenceDate(quote) {
  if (quote?.baseDate) return new Date(`${quote.baseDate}T12:00:00`);
  return new Date();
}
