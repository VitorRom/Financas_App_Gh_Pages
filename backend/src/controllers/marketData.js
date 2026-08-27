import { getQuote, getCryptoQuote, getCDI, getIBOV, getQuoteForAsset } from '../services/brapi.js';

export const getTickerQuote = () => async (req, res) => {
  try {
    const { ticker } = req.params;
    if (!ticker) return res.status(400).json({ error: 'Ticker é obrigatório' });

    const quote = await getQuote(ticker);
    res.json(quote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const refreshAllPrices = (prisma) => async (req, res) => {
  try {
    const investments = await prisma.investment.findMany({
      where: { userId: req.user.id, isActive: true, ticker: { not: null } },
    });

    const results = [];

    for (const inv of investments) {
      const quote = await getQuoteForAsset(inv.assetType, inv.ticker);

      if (quote?.untracked) {
        results.push({
          ticker: inv.ticker,
          assetType: inv.assetType,
          success: false,
          skipped: true,
          reason: quote.help,
          tickerHint: quote.tickerHint,
          whereToTrack: quote.whereToTrack,
        });
        continue;
      }

      if (quote && !quote.error && quote.price) {
        await prisma.investment.update({
          where: { id: inv.id },
          data: {
            currentPrice: quote.price,
            lastPriceUpdate: new Date(),
          },
        });

        // Salvar histórico
        const today = new Date(new Date().toISOString().split('T')[0]);
        await prisma.priceHistory.upsert({
          where: { ticker_date: { ticker: inv.ticker, date: today } },
          update: { price: quote.price },
          create: {
            ticker: inv.ticker,
            price: quote.price,
            date: today,
            source: 'BRAPI',
          },
        });

        results.push({ ticker: inv.ticker, price: quote.price, success: true });
      } else {
        results.push({
          ticker: inv.ticker,
          assetType: inv.assetType,
          success: false,
          error: quote?.error || 'Sem cotação',
        });
      }
    }

    res.json({ updated: results.filter((r) => r.success).length, total: results.length, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getIndices = () => async (req, res) => {
  try {
    const [cdi, ibov] = await Promise.all([getCDI(), getIBOV()]);
    res.json({ cdi, ibov });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getIndexHistory = (prisma) => async (req, res) => {
  try {
    const { index } = req.query;
    const months = parseInt(req.query.months) || 12;

    if (!index) return res.status(400).json({ error: 'Parâmetro index é obrigatório' });

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const history = await prisma.marketIndex.findMany({
      where: {
        indexName: index,
        referenceDate: { gte: startDate },
      },
      orderBy: { referenceDate: 'asc' },
    });

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
