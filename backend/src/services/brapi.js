// BrAPI wrapper — cotações de ativos brasileiros
// https://brapi.dev/api

import * as tesouroTransparente from './tesouroTransparente.js';

const BASE_URL = 'https://brapi.dev/api';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const SEARCH_CACHE_TTL = 60 * 1000; // 1 minuto (busca muda muito)

const cache = new Map();

// Orientação por tipo de ativo — usada quando não há cotação pública via BrAPI.
// `whereToTrack` indica onde o usuário pode consultar preço/rentabilidade.
// `tickerHint` explica o formato esperado do identificador (se houver).
const ASSET_TYPE_GUIDANCE = {
  TESOURO_DIRETO: {
    assetType: 'TESOURO_DIRETO',
    tickerHint:
      'Tesouro Direto não tem ticker de bolsa. Use a busca de ativos (ícone de lupa) para localizar o título pelo nome (ex: "Tesouro IPCA+ 2050") e selecione-o. O identificador usado será o symbol do BrAPI (ex: "tesouro-ipca-15082050").',
    whereToTrack:
      'Preço e taxa podem ser consultados em https://www.tesourodireto.com.br/titulos/precos-e-taxas.htm ou na sua corretora.',
    help:
      'Tesouro Direto é negociado na plataforma do Tesouro (tesourodireto.com.br) ou via corretora. Cotações vêm do Tesouro Transparente (oficial, gratuito) ou BrAPI Pro.',
  },
  RENDA_FIXA: {
    assetType: 'RENDA_FIXA',
    tickerHint:
      'CDB, LCI, LCA, debêntures e demais produtos de renda fixa não têm ticker de bolsa. Use o nome do produto como identificador (ex: "CDB Banco X 2028").',
    whereToTrack:
      'Acompanhe na sua corretora ou na página do emissor. Para referência de mercado, a ANBIMA publica taxas diárias.',
    help:
      'Renda fixa privada (CDB/LCI/LCA/debêntures) não tem cotação pública. O valor da posição é atualizado pela taxa contratada na data de resgate.',
  },
  PREVIDENCIA: {
    assetType: 'PREVIDENCIA',
    tickerHint:
      'PGBL e VGBL não têm ticker. Use o nome do plano (ex: "PGBL Bradesco Prime").',
    whereToTrack:
      'Consulte a rentabilidade no extrato do seu plano (app/site da seguradora) ou no informe anual enviado pela instituição.',
    help:
      'Planos de previdência (PGBL/VGBL) não têm cotação pública. A rentabilidade depende da carteira interna do plano.',
  },
  FUNDO: {
    assetType: 'FUNDO',
    tickerHint:
      'Fundos de investimento tradicionais não têm ticker. Use o CNPJ do fundo como identificador.',
    whereToTrack:
      'Cota e rentabilidade em https://www.gov.br/cvm/ ou nos portais das gestoras (ex: BTG, Itaú, XP).',
    help:
      'Fundos de investimento não-listados (não-ETF) não têm cotação em tempo real via BrAPI. A cota é divulgada diariamente pela CVM.',
  },
};


function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  const ttl = entry.ttl ?? CACHE_TTL;
  if (Date.now() - entry.timestamp > ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data, ttl = CACHE_TTL) {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

function buildUrl(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  const token = process.env.BRAPI_TOKEN;
  if (token) params.token = token;
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  return url.toString();
}

async function fetchWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const err = new Error(`BrAPI ${res.status}: ${res.statusText}`);
      err.status = res.status;
      err.unauthorized = res.status === 401;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function getQuote(ticker) {
  const key = `quote:${ticker}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const data = await fetchWithTimeout(buildUrl(`/quote/${ticker}`));
    const results = data?.results;
    if (!results?.length) return { error: 'Ticker não encontrado', stale: false };

    const quote = results[0];
    const result = {
      ticker: quote.symbol,
      price: quote.regularMarketPrice,
      previousClose: quote.regularMarketPreviousClose,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      updatedAt: quote.regularMarketTime
        ? new Date(quote.regularMarketTime).toISOString()
        : new Date().toISOString(),
      stale: false,
    };
    setCache(key, result);
    return result;
  } catch (err) {
    console.error(`BrAPI getQuote(${ticker}):`, err.message);
    return { error: err.message, stale: true, unauthorized: !!err.unauthorized };
  }
}

export async function getCryptoQuote(symbol) {
  const key = `crypto:${symbol}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const data = await fetchWithTimeout(
      buildUrl('/v2/crypto', { coin: symbol, currency: 'BRL' })
    );
    const coin = data?.coins?.[0];
    if (!coin) return { error: 'Cripto não encontrada', stale: false };

    const result = {
      ticker: coin.coin,
      price: coin.regularMarketPrice,
      change: coin.regularMarketChange,
      changePercent: coin.regularMarketChangePercent,
      updatedAt: new Date().toISOString(),
      stale: false,
    };
    setCache(key, result);
    return result;
  } catch (err) {
    console.error(`BrAPI getCryptoQuote(${symbol}):`, err.message);
    return { error: err.message, stale: true, unauthorized: !!err.unauthorized };
  }
}

export async function getCDI() {
  const key = 'index:CDI';
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const data = await fetchWithTimeout(buildUrl('/v2/prime-rate'));
    const result = {
      value: data?.primeRate?.[0]?.value,
      date: data?.primeRate?.[0]?.date,
      stale: false,
    };
    setCache(key, result);
    return result;
  } catch (err) {
    console.error('BrAPI getCDI:', err.message);
    return { error: err.message, stale: true, unauthorized: !!err.unauthorized };
  }
}

export async function getIBOV() {
  const key = 'index:IBOV';
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const data = await fetchWithTimeout(buildUrl('/quote/^BVSP'));
    const quote = data?.results?.[0];
    if (!quote) return { error: 'IBOV não disponível', stale: true };

    const result = {
      value: quote.regularMarketPrice,
      change: quote.regularMarketChangePercent,
      updatedAt: new Date().toISOString(),
      stale: false,
    };
    setCache(key, result);
    return result;
  } catch (err) {
    console.error('BrAPI getIBOV:', err.message);
    return { error: err.message, stale: true, unauthorized: !!err.unauthorized };
  }
}

export async function getQuoteForAsset(assetType, ticker) {
  if (!ticker) return null;

  // Tipos com cotação pública no BrAPI
  if (assetType === 'CRIPTO') return getCryptoQuote(ticker);
  if (assetType === 'ACAO' || assetType === 'FII' || assetType === 'ETF') {
    return getQuote(ticker);
  }
  if (assetType === 'TESOURO_DIRETO') {
    return getTreasuryQuote(ticker);
  }

  // Tipos sem cotação pública: retornamos orientação em vez de erro
  const guidance = ASSET_TYPE_GUIDANCE[assetType];
  if (guidance) {
    return {
      ticker,
      price: null,
      stale: true,
      untracked: true,
      ...guidance,
    };
  }

  // OUTRO ou tipo desconhecido: fallback genérico
  return {
    ticker,
    price: null,
    stale: true,
    untracked: true,
    assetType,
    help:
      'Tipo de ativo sem cotação automática. Cadastre a taxa/valor manualmente ou use a seção de aportes para registrar o preço.',
  };
}

// Catálogo estático de títulos do Tesouro Direto.
// Usado como fallback quando o BrAPI não retorna o endpoint /v2/treasury/list
// (plano Free, sem token, ou erro 403/404). Os títulos aqui listados são os
// ofertados historicamente — o usuário precisará consultar a taxa/preço atuais
// em tesourodireto.com.br antes de investir.
const TREASURY_CATALOG = [
  { symbol: 'tesouro-selic-01032031',              name: 'Tesouro Selic 2029',     indexer: 'selic',     couponType: 'zero',      maturityDate: '2029-03-01' },
  { symbol: 'tesouro-selic-01032031-pro',          name: 'Tesouro Selic 2031',     indexer: 'selic',     couponType: 'zero',      maturityDate: '2031-03-01' },
  { symbol: 'tesouro-prefixado-01012029',          name: 'Tesouro Prefixado 2029', indexer: 'prefixado', couponType: 'zero',      maturityDate: '2029-01-01' },
  { symbol: 'tesouro-prefixado-01012033',          name: 'Tesouro Prefixado 2033', indexer: 'prefixado', couponType: 'zero',      maturityDate: '2033-01-01' },
  { symbol: 'tesouro-ipca-15082032',               name: 'Tesouro IPCA+ 2032',     indexer: 'ipca',      couponType: 'zero',      maturityDate: '2032-08-15' },
  { symbol: 'tesouro-ipca-15052035',               name: 'Tesouro IPCA+ 2035',     indexer: 'ipca',      couponType: 'zero',      maturityDate: '2035-05-15' },
  { symbol: 'tesouro-ipca-15082040',               name: 'Tesouro IPCA+ 2040',     indexer: 'ipca',      couponType: 'zero',      maturityDate: '2040-08-15' },
  { symbol: 'tesouro-ipca-15052045',               name: 'Tesouro IPCA+ 2045',     indexer: 'ipca',      couponType: 'zero',      maturityDate: '2045-05-15' },
  { symbol: 'tesouro-ipca-15082050',               name: 'Tesouro IPCA+ 2050',     indexer: 'ipca',      couponType: 'zero',      maturityDate: '2050-08-15' },
  { symbol: 'tesouro-ipca-15082055',               name: 'Tesouro IPCA+ 2055',     indexer: 'ipca',      couponType: 'zero',      maturityDate: '2055-08-15' },
  { symbol: 'tesouro-ipca-com-juros-semestrais-15082060', name: 'Tesouro IPCA+ com Juros Semestrais 2060', indexer: 'ipca', couponType: 'semestral', maturityDate: '2060-08-15' },
  { symbol: 'tesouro-prefixado-com-juros-semestrais-01012037', name: 'Tesouro Prefixado com Juros Semestrais 2037', indexer: 'prefixado', couponType: 'semestral', maturityDate: '2037-01-01' },
  { symbol: 'tesouro-prefixado-com-juros-semestrais-01012049', name: 'Tesouro Prefixado com Juros Semestrais 2049', indexer: 'prefixado', couponType: 'semestral', maturityDate: '2049-01-01' },
  { symbol: 'tesouro-igpm-com-juros-semestrais-15032025', name: 'Tesouro IGP-M com Juros Semestrais 2025', indexer: 'igpm', couponType: 'semestral', maturityDate: '2025-03-15' },
  { symbol: 'tesouro-igpm-com-juros-semestrais-15032030', name: 'Tesouro IGP-M com Juros Semestrais 2030', indexer: 'igpm', couponType: 'semestral', maturityDate: '2030-03-15' },
];

/** Dados do Tesouro Transparente podem ter delay de dias/semanas. */
function isTreasuryDataStale(baseDate) {
  if (!baseDate) return true;
  const d = new Date(`${baseDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return true;
  const ageDays = (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000);
  return ageDays > 5;
}

async function searchTreasuryFromTransparente(query) {
  try {
    const results = await tesouroTransparente.searchTreasury(query);
    if (!results.length) return null;
    return results.map((r) => ({
      ...r,
      stale: isTreasuryDataStale(r.baseDate),
      manualPricing: r.price == null,
    }));
  } catch (err) {
    console.error(`TesouroTransparente searchTreasury(${query}):`, err.message);
    return null;
  }
}

async function getTreasuryQuoteFromTransparente(symbol) {
  try {
    const quote = await tesouroTransparente.getTreasuryQuote(symbol);
    if (!quote || quote.error) return null;
    return {
      ...quote,
      stale: isTreasuryDataStale(quote.baseDate),
      manualPricing: quote.price == null,
    };
  } catch (err) {
    console.error(`TesouroTransparente getTreasuryQuote(${symbol}):`, err.message);
    return null;
  }
}

function searchTreasuryFallback(query) {
  // Normaliza a query: lowercase, remove acentos, trata '+' como espaço
  // (usuário digita "IPCA+2050" e o nome do título é "IPCA+ 2050" com espaço).
  const normalize = (s) =>
    s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\+/g, ' ')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const q = normalize(query);
  return TREASURY_CATALOG
    .filter((t) => {
      const haystack = normalize(
        `${t.name} ${t.indexer} ${t.maturityDate} ${t.symbol}`
      );
      return haystack.includes(q);
    })
    .map((t) => ({
      source: 'TESOURO_DIRETO_FALLBACK',
      ticker: t.symbol,
      name: t.name,
      indexer: t.indexer,
      couponType: t.couponType,
      maturityDate: t.maturityDate,
      // Sem cotação automática — o usuário precisa consultar manualmente
      buyPrice: null,
      sellPrice: null,
      basePrice: null,
      buyRate: null,
      sellRate: null,
      rateInfo: null,
      price: null,
      manualPricing: true,
      whereToTrack: 'https://www.tesourodireto.com.br/titulos/precos-e-taxas.htm',
    }));
}

async function searchTreasury(query) {
  const cacheKey = `treasury:search:${query.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchWithTimeout(
      buildUrl('/v2/treasury/list', { search: query, limit: 20 })
    );
    const items = (data?.results || []).map((t) => ({
      source: 'TESOURO_DIRETO',
      ticker: t.symbol,
      name: t.bondType,
      indexer: t.indexer,
      couponType: t.couponType,
      maturityDate: t.maturityDate,
      durationDays: t.durationDays,
      baseDate: t.baseDate,
      buyPrice: t.buyPrice,
      sellPrice: t.sellPrice,
      basePrice: t.basePrice,
      buyRate: t.buyRate,
      sellRate: t.sellRate,
      rateInfo: t.rateInfo,
      price: t.basePrice ?? t.sellPrice ?? t.buyPrice ?? null,
    }));
    setCache(cacheKey, items, SEARCH_CACHE_TTL);
    return items;
  } catch (err) {
    const status = err.status;
    const isUnavailable = err.unauthorized || status === 403 || status === 404;
    console.error(
      `BrAPI searchTreasury(${query}): ${err.message}${isUnavailable ? ' — tentando Tesouro Transparente' : ''}`
    );

    const tt = await searchTreasuryFromTransparente(query);
    if (tt?.length) {
      setCache(cacheKey, tt, 24 * 60 * 60 * 1000);
      return tt;
    }

    const fallback = searchTreasuryFallback(query);
    setCache(cacheKey, fallback, 60 * 60 * 1000);
    return fallback;
  }
}

async function searchStocksOrFIIs(query) {
  // Tenta match exato via /quote/{ticker}. BrAPI também aceita /quote/{ticker}?search=
  // mas a versão exata é mais confiável para tickers conhecidos.
  try {
    const quote = await getQuote(query);
    if (quote && !quote.error && quote.price) {
      return [{
        source: 'BRAPI_QUOTE',
        ticker: quote.ticker,
        name: quote.ticker,
        price: quote.price,
        previousClose: quote.previousClose,
        change: quote.change,
        changePercent: quote.changePercent,
        updatedAt: quote.updatedAt,
      }];
    }
    return [];
  } catch {
    return [];
  }
}

async function searchCrypto(query) {
  try {
    const q = await getCryptoQuote(query);
    if (q && !q.error && q.price) {
      return [{
        source: 'CRYPTO',
        ticker: q.ticker,
        name: q.ticker,
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
        updatedAt: q.updatedAt,
      }];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Busca unificada em ações/FIIs/ETFs, Tesouro Direto e cripto.
 * Retorna lista com `source` indicando a origem de cada resultado.
 */
export async function searchAssets(query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim();
  const [stocks, treasury, crypto] = await Promise.all([
    searchStocksOrFIIs(q),
    searchTreasury(q),
    searchCrypto(q),
  ]);
  return [...stocks, ...treasury, ...crypto];
}

/**
 * Cotação específica de um título do Tesouro Direto pelo symbol
 * (ex: "tesouro-ipca-15082060"). Faz busca exata via /v2/treasury/list.
 */
export async function getTreasuryQuote(symbol) {
  if (!symbol) return null;
  const key = `treasury:symbol:${symbol}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const data = await fetchWithTimeout(
      buildUrl('/v2/treasury/list', { search: symbol, limit: 10 })
    );
    const match = (data?.results || []).find((t) => t.symbol === symbol)
      || data?.results?.[0];
    if (!match) return { error: 'Título do Tesouro não encontrado', stale: false };

    const result = {
      source: 'TESOURO_DIRETO',
      ticker: match.symbol,
      name: match.bondType,
      indexer: match.indexer,
      maturityDate: match.maturityDate,
      buyPrice: match.buyPrice,
      sellPrice: match.sellPrice,
      basePrice: match.basePrice,
      buyRate: match.buyRate,
      sellRate: match.sellRate,
      rateInfo: match.rateInfo,
      price: match.basePrice ?? match.sellPrice ?? match.buyPrice ?? null,
      previousClose: match.basePrice,
      updatedAt: new Date().toISOString(),
      stale: false,
    };
    setCache(key, result);
    return result;
  } catch (err) {
    const status = err.status;
    const isUnavailable = err.unauthorized || status === 403 || status === 404;
    console.error(
      `BrAPI getTreasuryQuote(${symbol}): ${err.message}${isUnavailable ? ' — tentando Tesouro Transparente' : ''}`
    );

    const tt = await getTreasuryQuoteFromTransparente(symbol);
    if (tt) {
      setCache(key, tt, 24 * 60 * 60 * 1000);
      return tt;
    }

    const local = TREASURY_CATALOG.find((t) => t.symbol === symbol);
    if (local) {
      const fallback = {
        source: 'TESOURO_DIRETO_FALLBACK',
        ticker: local.symbol,
        name: local.name,
        indexer: local.indexer,
        maturityDate: local.maturityDate,
        buyPrice: null,
        sellPrice: null,
        basePrice: null,
        buyRate: null,
        sellRate: null,
        rateInfo: null,
        price: null,
        previousClose: null,
        updatedAt: new Date().toISOString(),
        stale: true,
        manualPricing: true,
        whereToTrack: 'https://www.tesourodireto.com.br/titulos/precos-e-taxas.htm',
      };
      setCache(key, fallback);
      return fallback;
    }

    return { error: err.message, stale: true, unauthorized: !!err.unauthorized };
  }
}
