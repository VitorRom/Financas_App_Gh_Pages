import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

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

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function AllocationPieChart({ data, title = 'Alocação por Tipo' }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
        Sem dados de alocação
      </div>
    );
  }

  const total = Object.values(data).reduce((s, v) => s + v, 0);
  const chartData = Object.entries(data)
    .map(([key, value]) => ({
      name: ASSET_TYPE_LABELS[key] || key,
      value: Math.round(value * 100) / 100,
      pct: total > 0 ? ((value / total) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: 'var(--tooltip-bg, #fff)',
              borderColor: 'var(--tooltip-border, #e5e7eb)',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
            }}
          />
          <Legend
            formatter={(value, entry) => {
              const item = chartData.find((d) => d.name === value);
              return `${value} (${item?.pct}%)`;
            }}
            wrapperStyle={{ fontSize: '0.75rem' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
