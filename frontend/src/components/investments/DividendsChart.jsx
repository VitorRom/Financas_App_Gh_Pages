import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function DividendsChart({ data, year }) {
  if (!data) return null;

  const chartData = Object.entries(data).map(([month, info]) => ({
    month: MONTH_NAMES[parseInt(month) - 1],
    total: info.total,
  }));

  const hasData = chartData.some((d) => d.total > 0);

  if (!hasData) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
        Nenhum provento recebido em {year}
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Proventos {year}
      </h4>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <YAxis
            tickFormatter={(v) => formatCurrency(v)}
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            width={70}
          />
          <Tooltip
            formatter={(value) => [formatCurrency(value), 'Proventos']}
            contentStyle={{
              backgroundColor: 'var(--tooltip-bg, #fff)',
              borderColor: 'var(--tooltip-border, #e5e7eb)',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
            }}
          />
          <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
