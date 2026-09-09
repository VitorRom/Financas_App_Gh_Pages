import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ConfirmProvider } from './context/ConfirmContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import { LoadingState } from './components/ui/StateMessage.jsx';

// Login e Dashboard entram no bundle inicial: são as duas primeiras telas de
// qualquer sessão. O resto é carregado sob demanda — Recharts sozinho pesa mais
// que toda a aplicação e só é usado em Planejamento e Investimentos.
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';

const Register = lazy(() => import('./pages/Register.jsx'));
const Transactions = lazy(() => import('./pages/Transactions.jsx'));
const Categories = lazy(() => import('./pages/Categories.jsx'));
const Accounts = lazy(() => import('./pages/Accounts.jsx'));
const Goals = lazy(() => import('./pages/Goals.jsx'));
const Planning = lazy(() => import('./pages/Planning.jsx'));
const Investments = lazy(() => import('./pages/Investments.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Subscription = lazy(() => import('./pages/Subscription.jsx'));

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <Suspense fallback={<LoadingState />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/cadastro" element={<Register />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="transactions" element={<Transactions />} />
                    <Route path="categories" element={<Categories />} />
                    <Route path="accounts" element={<Accounts />} />
                    <Route path="goals" element={<Goals />} />
                    <Route path="planning" element={<Planning />} />
                    <Route path="investimentos" element={<Investments />} />
                    <Route path="perfil" element={<Profile />} />
                    <Route path="assinatura" element={<Subscription />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
