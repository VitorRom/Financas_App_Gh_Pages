import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Wallet,
  ArrowLeftRight,
  CalendarRange,
  Target,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Check,
} from 'lucide-react';

/**
 * Apresentação de primeiro uso.
 *
 * Deliberadamente autocontida: nenhum passo aponta para um elemento da página nem
 * troca de rota. A tentativa anterior fazia as duas coisas com `react-joyride` e
 * era exatamente daí que vinham as travadas — o passo avançava antes do elemento
 * alvo existir na tela seguinte. Aqui cada passo desenha a própria ilustração, então
 * não há o que esperar: a navegação entre passos é instantânea.
 */

/* ---------------------------------------------------------------- ilustrações */

function MiniCard({ label, value, tone = 'blue', width = 'w-full' }) {
  const tones = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    green: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300',
  };
  return (
    <div className={`${width} rounded-lg px-3 py-2.5 ${tones[tone]}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-sm font-bold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function VisualOverview() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <MiniCard label="Saldo" value="R$ 4.820" tone="blue" />
      <MiniCard label="Receitas" value="R$ 6.400" tone="green" />
      <MiniCard label="Despesas" value="R$ 3.180" tone="red" />
      <MiniCard label="Economizado" value="R$ 3.220" tone="violet" />
    </div>
  );
}

function VisualAccounts() {
  const contas = [
    { nome: 'Itaú', tipo: 'Conta corrente', valor: 'R$ 3.240', cor: '#10b981' },
    { nome: 'Nubank', tipo: 'Cartão de crédito', valor: '− R$ 890', cor: '#ef4444' },
    { nome: 'BTG', tipo: 'Investimentos', valor: 'derivado', cor: '#8b5cf6' },
  ];
  return (
    <div className="space-y-1.5">
      {contas.map((c) => (
        <div
          key={c.nome}
          className="flex items-center gap-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-2"
        >
          <span className="h-7 w-7 shrink-0 rounded-md" style={{ backgroundColor: `${c.cor}22` }}>
            <span className="block h-full w-full rounded-md" style={{ backgroundColor: `${c.cor}33` }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-gray-800 dark:text-gray-100">{c.nome}</span>
            <span className="block text-[10px] text-gray-500 dark:text-gray-400">{c.tipo}</span>
          </span>
          <span className="text-xs font-bold tabular-nums text-gray-700 dark:text-gray-200">{c.valor}</span>
        </div>
      ))}
    </div>
  );
}

function VisualTransactions() {
  const linhas = [
    { desc: 'Salário', cat: 'Salário', valor: '+ R$ 6.400', positivo: true },
    { desc: 'Supermercado', cat: 'Mercado', valor: '− R$ 412', positivo: false },
    { desc: 'iFood', cat: 'Alimentação', valor: '− R$ 68', positivo: false },
  ];
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 rounded-md bg-primary-50 dark:bg-primary-900/25 px-2.5 py-1.5 text-[10px] font-medium text-primary-700 dark:text-primary-300">
        <Sparkles size={11} aria-hidden />
        Extrato importado · categorias preenchidas automaticamente
      </div>
      {linhas.map((l) => (
        <div
          key={l.desc}
          className="flex items-center gap-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-2"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-gray-800 dark:text-gray-100">{l.desc}</span>
            <span className="block text-[10px] text-gray-500 dark:text-gray-400">{l.cat}</span>
          </span>
          <span
            className={`text-xs font-bold tabular-nums ${
              l.positivo ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
            }`}
          >
            {l.valor}
          </span>
        </div>
      ))}
    </div>
  );
}

function VisualPlanning() {
  // Sparkline do saldo projetado. Coordenadas fixas — é ilustração, não dado real.
  const pontos = [8, 22, 30, 41, 47, 60, 68, 84];
  const largura = 260;
  const altura = 76;
  const passo = largura / (pontos.length - 1);
  const linha = pontos.map((p, i) => `${i * passo},${altura - (p / 100) * altura}`).join(' ');
  const area = `0,${altura} ${linha} ${largura},${altura}`;

  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 p-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Saldo projetado · 12 meses
        </span>
        <span className="text-xs font-bold tabular-nums text-primary-600 dark:text-primary-400">R$ 42.600</span>
      </div>
      <svg viewBox={`0 0 ${largura} ${altura}`} className="w-full" role="img" aria-label="Saldo crescendo ao longo de 12 meses">
        <defs>
          <linearGradient id="tour-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#tour-area)" />
        <polyline points={linha} fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={largura} cy={altura - (pontos[pontos.length - 1] / 100) * altura} r="3.5" fill="#0284c7" />
      </svg>
    </div>
  );
}

function VisualGoals() {
  const metas = [
    { nome: 'Reserva de emergência', pct: 72, cor: 'bg-emerald-500' },
    { nome: 'Entrada do apartamento', pct: 34, cor: 'bg-primary-500' },
    { nome: 'Viagem', pct: 15, cor: 'bg-violet-500' },
  ];
  return (
    <div className="space-y-2.5">
      {metas.map((m) => (
        <div key={m.nome}>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[11px] font-medium text-gray-700 dark:text-gray-200">{m.nome}</span>
            <span className="text-[11px] font-bold tabular-nums text-gray-500 dark:text-gray-400">{m.pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
            <div className={`h-full rounded-full ${m.cor}`} style={{ width: `${m.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function VisualInvestments() {
  const fatias = [
    { nome: 'Ações', pct: 42, cor: '#0284c7' },
    { nome: 'FIIs', pct: 28, cor: '#8b5cf6' },
    { nome: 'Renda fixa', pct: 30, cor: '#10b981' },
  ];
  const raio = 26;
  const circunferencia = 2 * Math.PI * raio;
  let acumulado = 0;

  return (
    <div className="flex items-center gap-4 rounded-lg bg-gray-50 dark:bg-gray-700/40 p-3">
      <svg viewBox="0 0 72 72" className="h-20 w-20 shrink-0" role="img" aria-label="Carteira dividida entre ações, fundos imobiliários e renda fixa">
        {fatias.map((f) => {
          const traco = (f.pct / 100) * circunferencia;
          const el = (
            <circle
              key={f.nome}
              cx="36"
              cy="36"
              r={raio}
              fill="none"
              stroke={f.cor}
              strokeWidth="11"
              strokeDasharray={`${traco} ${circunferencia - traco}`}
              strokeDashoffset={-acumulado}
              transform="rotate(-90 36 36)"
            />
          );
          acumulado += traco;
          return el;
        })}
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {fatias.map((f) => (
          <div key={f.nome} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: f.cor }} />
            <span className="flex-1 text-[11px] text-gray-600 dark:text-gray-300">{f.nome}</span>
            <span className="text-[11px] font-bold tabular-nums text-gray-700 dark:text-gray-200">{f.pct}%</span>
          </div>
        ))}
        <p className="pt-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">+ 8,4% no ano</p>
      </div>
    </div>
  );
}

function VisualReady() {
  const passos = ['Cadastre suas contas', 'Registre ou importe transações', 'Defina uma meta'];
  return (
    <div className="space-y-1.5">
      {passos.map((p, i) => (
        <div
          key={p}
          className="flex items-center gap-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-2.5"
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              i === 0
                ? 'bg-primary-600 text-white'
                : 'border border-gray-300 dark:border-gray-500 text-gray-400 dark:text-gray-500'
            }`}
          >
            {i === 0 ? <Check size={11} strokeWidth={3} aria-hidden /> : i + 1}
          </span>
          <span className="text-xs text-gray-700 dark:text-gray-200">{p}</span>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-gray-500 dark:text-gray-400">
        Essa lista fica no topo do Dashboard e some sozinha quando você terminar.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------------- passos */

const STEPS = [
  {
    id: 'boas-vindas',
    icon: Sparkles,
    eyebrow: 'Boas-vindas',
    title: 'Suas finanças, do mês atual ao longo prazo',
    body: 'Em um minuto você vê o que dá para fazer por aqui. Pode pular e voltar depois pelo seu perfil.',
    Visual: VisualOverview,
  },
  {
    id: 'contas',
    icon: Wallet,
    eyebrow: 'Contas',
    title: 'Comece cadastrando onde seu dinheiro está',
    body: 'Conta corrente, poupança, cartão e dinheiro em espécie. Cartão de crédito entra como saldo negativo, e conta de investimento tem saldo calculado a partir dos ativos.',
    Visual: VisualAccounts,
  },
  {
    id: 'transacoes',
    icon: ArrowLeftRight,
    eyebrow: 'Transações',
    title: 'Lance à mão ou importe o extrato',
    body: 'Extratos do Itaú, PicPay e BTG são lidos direto do arquivo, com categorias sugeridas pela descrição. Ao corrigir uma categoria, você pode aplicar a mesma regra às transações parecidas.',
    Visual: VisualTransactions,
  },
  {
    id: 'planejamento',
    icon: CalendarRange,
    eyebrow: 'Planejamento',
    title: 'Veja o saldo dos próximos meses',
    body: 'Cadastre receitas e despesas fixas — com data de início e duração, se forem temporárias — e acompanhe a projeção mês a mês.',
    Visual: VisualPlanning,
  },
  {
    id: 'metas',
    icon: Target,
    eyebrow: 'Metas',
    title: 'Descubra quanto guardar por mês',
    body: 'Informe o valor que quer alcançar, o prazo e o rendimento esperado. O aporte mensal e o cronograma de parcelas saem prontos, com juros compostos.',
    Visual: VisualGoals,
  },
  {
    id: 'investimentos',
    icon: TrendingUp,
    eyebrow: 'Investimentos',
    title: 'Acompanhe a carteira com cotação do dia',
    body: 'Ações, fundos imobiliários, renda fixa e Tesouro Direto, com preço médio, proventos e alocação por tipo e corretora.',
    Visual: VisualInvestments,
  },
  {
    id: 'pronto',
    icon: Check,
    eyebrow: 'Tudo certo',
    title: 'Três passos e o Dashboard ganha vida',
    body: 'Ele começa zerado porque ainda não há dados — é só seguir a lista abaixo.',
    Visual: VisualReady,
  },
];

/* ------------------------------------------------------------------ componente */

export default function WelcomeTour({ onFinish }) {
  const [index, setIndex] = useState(0);
  const [closing, setClosing] = useState(false);
  const dialog = useRef(null);
  const nextButton = useRef(null);

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const finish = useCallback(() => {
    if (closing) return;
    setClosing(true);
    onFinish();
  }, [closing, onFinish]);

  const goNext = useCallback(() => {
    if (isLast) finish();
    else setIndex((i) => i + 1);
  }, [isLast, finish]);

  const goBack = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    nextButton.current?.focus();
  }, [index]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish();
      } else if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'ArrowLeft') {
        goBack();
      } else if (e.key === 'Tab') {
        // Prende o foco dentro do diálogo.
        const focusables = dialog.current?.querySelectorAll(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables?.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finish, goNext, goBack]);

  // Trava o scroll do fundo enquanto a apresentação estiver aberta.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const Icon = step.icon;
  const Visual = step.Visual;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400">
              <Icon size={18} aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-600 dark:text-primary-400">
                {step.eyebrow}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {index + 1} de {STEPS.length}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={finish}
            className="-m-1 rounded p-1 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Fechar apresentação"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="px-5 py-5">
          <h2 id="tour-title" className="text-lg font-bold leading-snug text-gray-900 dark:text-white">
            {step.title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{step.body}</p>

          <div className="mt-4" key={step.id}>
            <Visual />
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3.5 dark:border-gray-700">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Progresso da apresentação">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Passo ${i + 1}: ${s.eyebrow}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === index
                    ? 'w-5 bg-primary-600 dark:bg-primary-400'
                    : 'w-1.5 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {index === 0 ? (
              <button
                type="button"
                onClick={finish}
                className="px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Pular
              </button>
            ) : (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <ArrowLeft size={15} aria-hidden />
                Voltar
              </button>
            )}

            <button
              type="button"
              ref={nextButton}
              onClick={goNext}
              className="btn btn-primary inline-flex items-center gap-1.5 text-sm"
            >
              {isLast ? 'Começar' : 'Próximo'}
              {isLast ? <Check size={15} aria-hidden /> : <ArrowRight size={15} aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
