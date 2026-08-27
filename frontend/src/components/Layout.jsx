import { Link, Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  ArrowLeftRight,
  Tags,
  Wallet,
  Moon,
  Sun,
  Target,
  CalendarRange,
  LogOut,
  User,
  CreditCard,
  TrendingUp,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', !darkMode);
  };

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const navItems = [
    { to: '/', icon: Home, label: 'Dashboard' },
    { to: '/planning', icon: CalendarRange, label: 'Planejamento' },
    { to: '/transactions', icon: ArrowLeftRight, label: 'Transações' },
    { to: '/accounts', icon: Wallet, label: 'Contas' },
    { to: '/goals', icon: Target, label: 'Metas' },
    { to: '/investimentos', icon: TrendingUp, label: 'Investimentos' },
    { to: '/categories', icon: Tags, label: 'Categorias' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400 shrink-0">
            Finanças Pessoais
          </h1>
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <span
              className="hidden sm:block text-sm text-gray-600 dark:text-gray-400 truncate max-w-[140px] md:max-w-[200px]"
              title={user?.email || ''}
            >
              {user?.name || user?.email}
            </span>
            <Link
              to="/perfil"
              className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Perfil"
            >
              <User size={20} />
            </Link>
            <Link
              to="/assinatura"
              className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Assinatura"
            >
              <CreditCard size={20} />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title={darkMode ? 'Modo claro' : 'Modo escuro'}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6 pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation - Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 md:hidden">
        <div className="flex justify-around">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center py-3 px-4 ${
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`
              }
            >
              <item.icon size={24} />
              <span className="text-xs mt-1">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <nav className="hidden md:fixed md:left-0 md:top-16 md:bottom-0 md:w-64 md:bg-white md:dark:bg-gray-800 md:border-r md:border-gray-200 md:dark:border-gray-700 md:flex md:flex-col md:py-4">
        <div className="px-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Desktop content offset */}
      <style>{`
        @media (min-width: 768px) {
          main {
            margin-left: 16rem;
          }
        }
      `}</style>
    </div>
  );
}