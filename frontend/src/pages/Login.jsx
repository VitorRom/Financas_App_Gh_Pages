import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Wallet,
  Mail,
  Lock,
  ArrowRight,
  LineChart,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

function BrandPanel() {
  return (
    <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden text-white bg-gradient-to-br from-slate-950 via-violet-950 to-primary-950">
      {/* Ornamentos */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-violet-500/30 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-primary-500/30 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="relative z-10 p-12 flex flex-col h-full">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/20 shadow-2xl">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight">Finanças</div>
            <div className="text-xs text-white/60 -mt-0.5">Controle financeiro pessoal</div>
          </div>
        </div>

        <div className="space-y-6 max-w-md my-auto py-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur px-3 py-1 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Suas finanças, com clareza
          </div>
          <h2 className="text-4xl font-bold leading-tight">
            Planeje o futuro com{' '}
            <span className="bg-gradient-to-r from-primary-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              projeção mês a mês
            </span>
            .
          </h2>
          <p className="text-white/70 text-base leading-relaxed">
            Cadastre receitas e despesas fixas, simule cenários e descubra quando cada meta se torna realidade.
          </p>

          <ul className="space-y-3 pt-2">
            {[
              { icon: LineChart, title: 'Projeção financeira', desc: 'Veja a evolução do seu saldo em até 24 meses.' },
              { icon: Target, title: 'Metas e investimentos', desc: 'Acompanhe objetivos com juros compostos reais.' },
              { icon: ShieldCheck, title: 'Seus dados seguros', desc: 'Criptografia e autenticação por token.' },
            ].map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15 backdrop-blur">
                  <Icon className="w-4 h-4 text-primary-300" />
                </span>
                <div>
                  <div className="font-semibold text-sm">{title}</div>
                  <div className="text-xs text-white/65">{desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-xs text-white/50">
          © {new Date().getFullYear()} Finanças • Feito com cuidado
        </div>
      </div>
    </aside>
  );
}

function BrandHeaderMobile() {
  return (
    <div className="lg:hidden mb-8 flex items-center gap-3 justify-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-violet-600 shadow-lg shadow-primary-600/30">
        <Wallet className="w-6 h-6 text-white" />
      </div>
      <div>
        <div className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Finanças</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 -mt-0.5">Controle financeiro pessoal</div>
      </div>
    </div>
  );
}

export default function Login() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || '/';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-10 w-10 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível entrar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
        <BrandPanel />

        <main className="flex items-center justify-center p-6 sm:p-10 bg-gray-50 dark:bg-gray-950">
          <div className="w-full max-w-md">
            <BrandHeaderMobile />

            <div className="relative">
              {/* Linha decorativa no topo */}
              <div className="absolute -top-3 left-8 right-8 h-1 rounded-full bg-gradient-to-r from-primary-500 via-violet-500 to-fuchsia-500" />

              <div className="relative rounded-2xl bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-800 shadow-2xl shadow-gray-900/10 dark:shadow-black/40 p-8">
                <div className="space-y-1.5 mb-6">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bem-vindo de volta</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Entre com sua conta para acessar seu painel.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="label" htmlFor="email">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="seu@email.com"
                        className="input pl-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="password">
                      Senha
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="input pl-9"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-full inline-flex items-center justify-center gap-2 shadow-md shadow-primary-600/25 hover:shadow-primary-600/40"
                    disabled={submitting}
                  >
                    {submitting ? 'Entrando…' : 'Entrar'}
                    {!submitting && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800 text-center text-sm text-gray-600 dark:text-gray-400">
                  Não tem conta?{' '}
                  <Link
                    to="/cadastro"
                    className="text-primary-600 dark:text-primary-400 font-semibold hover:underline"
                  >
                    Criar conta grátis
                  </Link>
                </div>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-500">
              Ao continuar, você concorda com nossos termos de uso.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
