import { TrendingUp, TrendingDown, MoreVertical, RefreshCw } from 'lucide-react';

const ASSET_TYPE_LABELS = {
  RENDA_FIXA: 'Renda Fixa',
  ACAO: 'Ação',
  FII: 'FII',
  ETF: 'ETF',
  CRIPTO: 'Cripto',
  FUNDO: 'Fundo',
  TESOURO_DIRETO: 'Tesouro Direto',
  PREVIDENCIA: 'Previdência',
  OUTRO: 'Outro',
};

const ASSET_TYPE_COLORS = {
  RENDA_FIXA: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  ACAO: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  FII: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  ETF: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
  CRIPTO: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  FUNDO: 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
  TESOURO_DIRETO: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  PREVIDENCIA: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  OUTRO: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
};

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function AssetCard({ investment, onSelect, onRefreshPrice }) {
  const { absoluteGain = 0, percentageGain = 0, currentValue = 0 } = investment;
  const isProfit = absoluteGain >= 0;

  return (
    <div
      className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect(investment)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ASSET_TYPE_COLORS[investment.assetType] || ASSET_TYPE_COLORS.OUTRO}`}>
              {ASSET_TYPE_LABELS[investment.assetType] || investment.assetType}
            </span>
            {investment.ticker && (
              <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">{investment.ticker}</span>
            )}
          </div>
          <p className="font-semibold text-gray-900 dark:text-white truncate">{investment.name}</p>
          {investment.broker && (
            <p className="text-xs text-gray-400 dark:text-gray-500">{investment.broker}</p>
          )}
          {['TESOURO_DIRETO', 'RENDA_FIXA'].includes(investment.assetType) && investment.interestRate != null && (
            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-300 mt-1">
              {investment.indexer === 'IPCA' ? `IPCA+${Number(investment.interestRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                : investment.indexer === 'PRE' ? `${Number(investment.interestRate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}% a.a.`
                : `${Number(investment.interestRate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%`}
            </p>
          )}
        </div>
        <button
          type="button"
          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
          title="Atualizar cotação"
          onClick={(e) => {
            e.stopPropagation();
            onRefreshPrice(investment.id);
          }}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Valor atual</p>
          <p className="font-bold text-gray-900 dark:text-white tabular-nums">{formatCurrency(currentValue)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">Rentabilidade</p>
          <div className={`flex items-center justify-end gap-1 font-bold tabular-nums ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
            {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {percentageGain >= 0 ? '+' : ''}{percentageGain.toFixed(2)}%
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Qtd</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 tabular-nums">{Number(investment.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 8 })}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">Ganho/Perda</p>
          <p className={`text-sm font-semibold tabular-nums ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
            {absoluteGain >= 0 ? '+' : ''}{formatCurrency(absoluteGain)}
          </p>
        </div>
      </div>
    </div>
  );
}

export { ASSET_TYPE_LABELS, ASSET_TYPE_COLORS };
