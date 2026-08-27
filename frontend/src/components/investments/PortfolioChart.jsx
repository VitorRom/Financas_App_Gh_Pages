import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function PortfolioChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
        Sem dados de evolução
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Evolução do Patrimônio</h4>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <YAxis
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            width={50}
          />
          <Tooltip
            formatter={(value, name) => {
              const labels = { aportes: 'Aportes', resgates: 'Resgates', proventos: 'Proventos' };
              return [formatCurrency(value), labels[name] || name];
            }}
            contentStyle={{
              backgroundColor: 'var(--tooltip-bg, #fff)',
              borderColor: 'var(--tooltip-border, #e5e7eb)',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
            }}
          />
          <Line type="monotone" dataKey="aportes" stroke="#6366f1" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="resgates" stroke="#ef4444" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="proventos" stroke="#10b981" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
