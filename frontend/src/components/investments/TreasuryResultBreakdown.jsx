import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { marketAPI } from '../../services/api.js';

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatPct(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2).replace('.', ',')}%`;
}

function formatRate(rate) {
  return rate == null ? '—' : `${Number(rate).toFixed(2).replace('.', ',')}%`;
}

/**
 * Por que um título do Tesouro aparece no negativo logo depois da compra.
 *
 * A posição é marcada pelo PU de VENDA — o que você receberia vendendo hoje — mas foi
 * comprada pelo PU de COMPRA, que é maior. A diferença entre os dois lados aparece como
 * prejuízo no primeiro dia, mesmo que a taxa tenha andado a favor. Sem separar as duas
 * coisas, o número parece contradizer a taxa travada.
 *
 *     resultado = (1 + valorização do título) × (1 − custo de saída) − 1
 */
export default function TreasuryResultBreakdown({ investment }) {
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    if (!investment?.ticker) return undefined;
    let cancelled = false;

    marketAPI
      .getQuote(investment.ticker, 'TESOURO_DIRETO')
      .then((q) => {
        if (!cancelled && q && !q.error) setQuote(q);
      })
      .catch(() => {
        /* sem cotação, o bloco simplesmente não aparece */
      });

    return () => {
      cancelled = true;
    };
  }, [investment?.ticker]);

  const paid = Number(investment?.averagePrice);
  const buyPrice = quote?.buyPrice != null ? Number(quote.buyPrice) : null;
  const sellPrice = quote?.sellPrice != null ? Number(quote.sellPrice) : Number(investment?.currentPrice);

  if (!quote || !paid || !buyPrice || !sellPrice) return null;

  const quantity = Number(investment.quantity) || 0;

  // Quanto o título andou, comparando lado de compra com lado de compra.
  const priceEffect = buyPrice / paid - 1;
  // Quanto custa sair hoje: a distância entre comprar e vender.
  const exitCost = sellPrice / buyPrice - 1;
  const total = sellPrice / paid - 1;

  const contractedRate = investment.interestRate != null ? Number(investment.interestRate) : null;
  const rateMovedInYourFavor = contractedRate != null && quote.buyRate != null && contractedRate > Number(quote.buyRate);

  const Row = ({ label, detail, value, amount, positive }) => (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm text-gray-800 dark:text-gray-200">{label}</p>
        {detail && <p className="text-[11px] text-gray-500 dark:text-gray-400">{detail}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p
          className={`text-sm font-semibold tabular-nums ${
            positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
          }`}
        >
          {value}
        </p>
        <p className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">{amount}</p>
      </div>
    </div>
  );

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">De onde vem o resultado</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        A posição é avaliada pelo preço de <strong>venda</strong> — o que você receberia
        vendendo hoje. Como a compra foi pelo preço de compra, que é maior, parte do
        resultado é só a distância entre os dois lados.
      </p>

      <div className="mt-4 divide-y divide-gray-100 dark:divide-gray-700">
        <Row
          label="O título valorizou"
          detail={`Você pagou ${formatBRL(paid)} · hoje compraria por ${formatBRL(buyPrice)}`}
          value={formatPct(priceEffect * 100)}
          amount={formatBRL(quantity * (buyPrice - paid))}
          positive={priceEffect >= 0}
        />
        <Row
          label="Custo de vender hoje"
          detail={`Compra ${formatBRL(buyPrice)} · venda ${formatBRL(sellPrice)}`}
          value={formatPct(exitCost * 100)}
          amount={formatBRL(quantity * (sellPrice - buyPrice))}
          positive={exitCost >= 0}
        />
        <div className="flex items-start justify-between gap-3 pt-3">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Resultado se vendesse hoje</p>
          <div className="shrink-0 text-right">
            <p
              className={`text-base font-bold tabular-nums ${
                total >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
              }`}
            >
              {formatPct(total * 100)}
            </p>
            <p className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
              {formatBRL(quantity * (sellPrice - paid))}
            </p>
          </div>
        </div>
      </div>

      {contractedRate != null && quote.buyRate != null && (
        <div
          className={`mt-4 rounded-lg px-3 py-2.5 ${
            rateMovedInYourFavor
              ? 'bg-emerald-50 dark:bg-emerald-950/30'
              : 'bg-gray-50 dark:bg-gray-700/40'
          }`}
        >
          <div className="flex items-center gap-2 text-sm">
            {rateMovedInYourFavor ? (
              <TrendingUp size={15} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : (
              <TrendingDown size={15} className="shrink-0 text-gray-500 dark:text-gray-400" aria-hidden />
            )}
            <span className="tabular-nums text-gray-800 dark:text-gray-200">
              Travou <strong>{formatRate(contractedRate)}</strong>
            </span>
            <ArrowRight size={13} className="shrink-0 text-gray-400" aria-hidden />
            <span className="tabular-nums text-gray-800 dark:text-gray-200">
              Hoje compra a <strong>{formatRate(quote.buyRate)}</strong>
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">
            {rateMovedInYourFavor
              ? 'Taxa contratada acima da atual: o título passou a valer mais. Se levar até o vencimento, é a sua taxa que vale — a marcação diária não muda o que você recebe.'
              : 'Taxa contratada abaixo da atual: o preço do título recuou. Levando até o vencimento, ainda assim é a sua taxa travada que define o retorno.'}
          </p>
        </div>
      )}
    </div>
  );
}
