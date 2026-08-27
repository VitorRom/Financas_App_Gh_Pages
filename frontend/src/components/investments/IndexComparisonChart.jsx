import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function IndexComparisonChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
        Sem dados de comparação
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Rentabilidade vs Indices</h4>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <YAxis
            tickFormatter={(v) => `${v.toFixed(1)}%`}
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            width={50}
          />
          <Tooltip
            formatter={(value, name) => [`${value.toFixed(2)}%`, name]}
            contentStyle={{
              backgroundColor: 'var(--tooltip-bg, #fff)',
              borderColor: 'var(--tooltip-border, #e5e7eb)',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
          <Line type="monotone" dataKey="carteira" name="Minha Carteira" stroke="#6366f1" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="cdi" name="CDI" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="5 5" />
          <Line type="monotone" dataKey="ibov" name="IBOV" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 5" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
