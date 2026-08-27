import { getQuote, getCDI, getIBOV, searchAssets } from '../../services/brapi.js';
import * as investmentsService from '../investments/investments.service.js';
import prisma from '../../shared/lib/prisma.js';

export async function getTickerQuote(req, res, next) {
  try {
    const { ticker } = req.params;
    if (!ticker) return res.status(400).json({ error: 'Ticker é obrigatório' });
    const quote = await getQuote(ticker);
    if (quote?.unauthorized) {
      return res.status(401).json({ error: 'BrAPI token inválido ou ausente. Configure BRAPI_TOKEN no .env.' });
    }
    res.json(quote);
  } catch (error) { next(error); }
}

export async function searchMarketAssets(req, res, next) {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Informe ao menos 2 caracteres para buscar.' });
    }
    const results = await searchAssets(q);
    res.json({ query: q, count: results.length, results });
  } catch (error) { next(error); }
}

export async function refreshAll(req, res, next) {
  try {
    const result = await investmentsService.refreshAllPrices(req.user.id);
    res.json(result);
  } catch (error) { next(error); }
}

export async function getIndices(req, res, next) {
  try {
    const [cdi, ibov] = await Promise.all([getCDI(), getIBOV()]);
    res.json({ cdi, ibov });
  } catch (error) { next(error); }
}

export async function getIndexHistory(req, res, next) {
  try {
    const { index } = req.query;
    const months = parseInt(req.query.months) || 12;
    if (!index) return res.status(400).json({ error: 'Parâmetro index é obrigatório' });

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const history = await prisma.marketIndex.findMany({
      where: { indexName: index, referenceDate: { gte: startDate } },
      orderBy: { referenceDate: 'asc' },
    });
    res.json(history);
  } catch (error) { next(error); }
}
