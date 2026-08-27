// Tesouro Transparente — fonte oficial do Tesouro Nacional (STN).
// CSV público: "Taxas dos Títulos Ofertados pelo Tesouro Direto".
// https://www.tesourotransparente.gov.br/ckan/dataset/taxas-dos-titulos-ofertados-pelo-tesouro-direto
//
// Schema CSV (separado por ';', cabeçalho na primeira linha):
//   Tipo Titulo | Data Vencimento (DD/MM/YYYY) | Data Base (DD/MM/YYYY)
//   | Taxa Compra Manha (%) | Taxa Venda Manha (%)
//   | PU Compra Manha (R$)  | PU Venda Manha (R$)  | PU Base Manha (R$)
//
// Cada linha = cotação de um título em uma data. Como o arquivo é cumulativo,
// mantemos apenas a linha mais recente de cada título (maior Data Base).
//
// Observação: o Tesouro Transparente NÃO atualiza todo dia — o dataset
// traz dados com delay (tipicamente dias, às vezes semanas). Para cotação
// em tempo real, é preciso BrAPI Pro ou scraping do site oficial.

import { createHash } from 'node:crypto';

const CSV_URL =
  'https://www.tesourotransparente.gov.br/ckan/dataset/' +
  'df56aa42-484a-4a59-8184-7676580c81e3/resource/' +
  '796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h — dataset atualiza ~diariamente
const FETCH_TIMEOUT = 30_000;

let cache = {
  loadedAt: 0,
  // Map<symbol, row> — apenas a cotação mais recente de cada título
  latest: new Map(),
  // Map<symbol, { name, indexer, couponType, maturityDate }> — metadados estáveis
  meta: new Map(),
  // Última Data Base vista no dataset (informativo)
  latestTradingDate: null,
};

// --- helpers ---------------------------------------------------------------

function parseNum(s) {
  if (s === undefined || s === null) return null;
  const t = String(s).trim().replace(/\./g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseDateBR(s) {
  if (!s) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s).trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function dateKey(s) {
  // Chave YYYYMMDD para comparar "mais recente"
  const iso = parseDateBR(s);
  return iso ? iso.replaceAll('-', '') : '00000000';
}

function titleToSymbol(tipo, vencimentoISO) {
  // Mapeia "Tipo Titulo" para o slug usado pelo catálogo/BrAPI.
  // Ex.: "Tesouro IPCA+ com Juros Semestrais" + "15/08/2050" ->
  //      "tesouro-ipca-com-juros-semestrais-15082050"
  // Sufixo da data no formato DDMMYYYY (compatível com o catálogo local).
  const slug = (s) =>
    s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const t = slug(tipo);
  const [yyyy, mm, dd] = vencimentoISO.split('-');
  return `${t}-${dd}${mm}${yyyy}`;
}

function tipoToIndexer(tipo) {
  const t = tipo.toLowerCase();
  if (t.includes('igpm')) return 'igpm';
  if (t.includes('ipca')) return 'ipca';
  if (t.includes('selic')) return 'selic';
  if (t.includes('prefixado')) return 'prefixado';
  if (t.includes('renda')) return 'renda+';
  if (t.includes('educa')) return 'educa+';
  return 'outro';
}

function tipoToCoupon(tipo) {
  const t = tipo.toLowerCase();
  return t.includes('juros semestrais') ? 'semestral' : 'zero';
}

function makeName(tipo, vencimentoISO) {
  const [yyyy] = vencimentoISO.split('-');
  return `${tipo} ${yyyy}`;
}

// --- fetch + parse ---------------------------------------------------------

async function fetchCsv() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(CSV_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'financas-app/1.0 (+tesouro-transparente)' },
    });
    if (!res.ok) {
      const err = new Error(`Tesouro Transparente ${res.status}: ${res.statusText}`);
      err.status = res.status;
      throw err;
    }
    const text = await res.text();
    if (text.length < 100) {
      throw new Error(`Tesouro Transparente CSV muito curto (${text.length} bytes)`);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return { latest: new Map(), meta: new Map(), latestTradingDate: null };

  const header = lines[0].split(';').map((h) => h.trim());
  const idx = {
    tipo: header.indexOf('Tipo Titulo'),
    venc: header.indexOf('Data Vencimento'),
    base: header.indexOf('Data Base'),
    taxaCompra: header.indexOf('Taxa Compra Manha'),
    taxaVenda: header.indexOf('Taxa Venda Manha'),
    puCompra: header.indexOf('PU Compra Manha'),
    puVenda: header.indexOf('PU Venda Manha'),
    puBase: header.indexOf('PU Base Manha'),
  };

  if (idx.tipo < 0 || idx.base < 0 || idx.puBase < 0) {
    throw new Error(`Cabeçalho CSV inesperado: ${lines[0]}`);
  }

  const latest = new Map(); // symbol -> { row, baseKey }
  const meta = new Map();   // symbol -> { name, indexer, couponType, maturityDate }
  let latestTradingDate = null;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (cols.length < header.length) continue;
    const tipo = cols[idx.tipo]?.trim();
    const vencISO = parseDateBR(cols[idx.venc]);
    const baseISO = parseDateBR(cols[idx.base]);
    if (!tipo || !vencISO || !baseISO) continue;

    const symbol = titleToSymbol(tipo, vencISO);
    const baseKey = dateKey(baseISO);

    if (!meta.has(symbol)) {
      meta.set(symbol, {
        symbol,
        name: makeName(tipo, vencISO),
        indexer: tipoToIndexer(tipo),
        couponType: tipoToCoupon(tipo),
        maturityDate: vencISO,
      });
    }

    const existing = latest.get(symbol);
    if (!existing || baseKey > existing.baseKey) {
      latest.set(symbol, {
        baseKey,
        baseISO,
        row: {
          symbol,
          tipo,
          vencimento: vencISO,
          baseDate: baseISO,
          taxaCompra: parseNum(cols[idx.taxaCompra]),
          taxaVenda: parseNum(cols[idx.taxaVenda]),
          puCompra: parseNum(cols[idx.puCompra]),
          puVenda: parseNum(cols[idx.puVenda]),
          puBase: parseNum(cols[idx.puBase]),
        },
      });
    }
  }

  // Descobrir a Data Base mais recente no arquivo (útil para UI/informes)
  for (const { baseISO } of latest.values()) {
    if (!latestTradingDate || baseISO > latestTradingDate) latestTradingDate = baseISO;
  }

  return { latest, meta, latestTradingDate };
}

async function ensureLoaded({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache.loadedAt && now - cache.loadedAt < CACHE_TTL && cache.latest.size > 0) {
    return cache;
  }
  const csv = await fetchCsv();
  const parsed = parseCsv(csv);
  cache = {
    loadedAt: now,
    latest: parsed.latest,
    meta: parsed.meta,
    latestTradingDate: parsed.latestTradingDate,
  };
  return cache;
}

// --- API pública -----------------------------------------------------------

function rowToQuote(symbol, latestEntry, metaEntry) {
  const row = latestEntry?.row;
  const meta = metaEntry;
  if (!row) return null;

  // `price` segue a convenção do getTreasuryQuote do brapi.js:
  // PU base > PU venda > PU compra
  const price = row.puBase ?? row.puVenda ?? row.puCompra ?? null;

  return {
    source: 'TESOURO_TRANSPARENTE',
    ticker: symbol,
    name: meta?.name ?? row.tipo,
    indexer: meta?.indexer ?? null,
    couponType: meta?.couponType ?? null,
    maturityDate: meta?.maturityDate ?? row.vencimento,
    buyPrice: row.puCompra,
    sellPrice: row.puVenda,
    basePrice: row.puBase,
    buyRate: row.taxaCompra,
    sellRate: row.taxaVenda,
    rateInfo: null,
    price,
    previousClose: row.puBase,
    baseDate: row.baseDate,
    updatedAt: new Date().toISOString(),
    stale: isDelayedQuote(row.baseDate),
  };
}

function isDelayedQuote(baseDate) {
  if (!baseDate) return true;
  const d = new Date(`${baseDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return true;
  return (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000) > 5;
}

export async function getTreasuryQuote(symbol) {
  if (!symbol) return null;
  try {
    const { latest, meta, latestTradingDate } = await ensureLoaded();
    const entry = latest.get(symbol);
    if (!entry) {
      // Tenta match aproximado (sufixo de data pode variar)
      const found = [...meta.keys()].find((k) => k.startsWith(symbol) || symbol.startsWith(k));
      if (!found) return { error: 'Título do Tesouro não encontrado no Tesouro Transparente', stale: false };
      return rowToQuote(found, latest.get(found), meta.get(found)) ?? { error: 'Sem cotação', stale: true };
    }
    const q = rowToQuote(symbol, entry, meta.get(symbol));
    if (q) q.referenceDate = latestTradingDate;
    return q;
  } catch (err) {
    console.error(`TesouroTransparente getTreasuryQuote(${symbol}):`, err.message);
    return { error: err.message, stale: true };
  }
}

function normalize(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\+/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchTreasury(query) {
  if (!query || query.length < 2) return [];
  try {
    const { latest, meta, latestTradingDate } = await ensureLoaded();
    const q = normalize(query);
    const today = new Date().toISOString().slice(0, 10);
    const results = [];
    for (const [symbol, m] of meta.entries()) {
      // Ignora títulos vencidos (mantidos no CSV apenas como histórico)
      if (m.maturityDate < today) continue;
      const hay = normalize(`${m.name} ${m.indexer} ${m.maturityDate} ${symbol}`);
      if (hay.includes(q)) {
        const entry = latest.get(symbol);
        const quote = rowToQuote(symbol, entry, m);
        results.push({
          ...quote,
          referenceDate: latestTradingDate,
          whereToTrack: 'https://www.tesourodireto.com.br/titulos/precos-e-taxas.htm',
        });
      }
    }
    // Ordena por data de vencimento (mais próximo primeiro) e limita
    results.sort((a, b) => (a.maturityDate || '').localeCompare(b.maturityDate || ''));
    return results.slice(0, 30);
  } catch (err) {
    console.error(`TesouroTransparente searchTreasury(${query}):`, err.message);
    return [];
  }
}

/**
 * Retorna todos os títulos ofertados (última cotação de cada).
 * Útil para popular listagens e sincronização inicial.
 */
export async function listAllTreasury() {
  const { latest, meta, latestTradingDate } = await ensureLoaded();
  const out = [];
  for (const [symbol, m] of meta.entries()) {
    const entry = latest.get(symbol);
    const q = rowToQuote(symbol, entry, m);
    if (q) {
      q.referenceDate = latestTradingDate;
      out.push(q);
    }
  }
  return out;
}

/** Invalida o cache — usado por testes ou após atualização do dataset. */
export function invalidateCache() {
  cache = { loadedAt: 0, latest: new Map(), meta: new Map(), latestTradingDate: null };
}

export function getCacheInfo() {
  return {
    loadedAt: cache.loadedAt,
    ageMs: cache.loadedAt ? Date.now() - cache.loadedAt : null,
    count: cache.latest.size,
    latestTradingDate: cache.latestTradingDate,
    cacheKey: createHash('sha1').update(CSV_URL).digest('hex').slice(0, 8),
  };
}
