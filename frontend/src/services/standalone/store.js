/**
 * Armazenamento do modo autônomo.
 *
 * No modo autônomo não existe API nem banco: tudo vive no navegador de quem está
 * usando. Isso torna possível publicar a aplicação em hospedagem estática (GitHub
 * Pages), mas tem um custo que o usuário precisa conhecer — limpar os dados do site
 * apaga tudo, e nada sincroniza entre dispositivos. Por isso o backup em arquivo
 * existe e fica visível no Perfil.
 */

const STORAGE_KEY = 'financas_standalone_db';
const SCHEMA_VERSION = 1;

/** Categorias iniciais, para a aplicação já abrir utilizável. */
const DEFAULT_CATEGORIES = [
  { name: 'Salário', type: 'income', color: '#10b981', icon: 'briefcase' },
  { name: 'Freelance', type: 'income', color: '#14b8a6', icon: 'laptop' },
  { name: 'Rendimentos', type: 'income', color: '#0ea5e9', icon: 'trending-up' },
  { name: 'Outras receitas', type: 'income', color: '#8b5cf6', icon: 'plus' },
  { name: 'Moradia', type: 'expense', color: '#eab308', icon: 'home' },
  { name: 'Mercado', type: 'expense', color: '#f59e0b', icon: 'shopping-cart' },
  { name: 'Alimentação', type: 'expense', color: '#ef4444', icon: 'utensils' },
  { name: 'Transporte', type: 'expense', color: '#f97316', icon: 'car' },
  { name: 'Saúde', type: 'expense', color: '#22c55e', icon: 'heart' },
  { name: 'Educação', type: 'expense', color: '#3b82f6', icon: 'book' },
  { name: 'Lazer', type: 'expense', color: '#ec4899', icon: 'smile' },
  { name: 'Assinaturas', type: 'expense', color: '#a855f7', icon: 'tv' },
  { name: 'Outros', type: 'expense', color: '#78716c', icon: 'more' },
];

const PLANS = [
  {
    id: 'plan-free',
    name: 'free',
    displayName: 'Gratuito',
    price: 0,
    maxTransactions: null,
    maxAccounts: null,
    isActive: true,
    features: { transactions: 'ilimitado', accounts: 'ilimitado', goals: true, planning: true },
  },
];

export function uuid() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

/** Erro com `status`, para o resto da aplicação tratar igual ao erro da API. */
export function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function emptyDatabase() {
  const createdAt = nowIso();
  return {
    version: SCHEMA_VERSION,
    user: {
      id: uuid(),
      email: 'voce@local',
      name: null,
      createdAt,
      updatedAt: createdAt,
      onboardingCompletedAt: null,
      subscription: {
        id: uuid(),
        status: 'active',
        plan: PLANS[0],
      },
    },
    accounts: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({
      id: uuid(),
      ...c,
      createdAt,
      updatedAt: createdAt,
    })),
    transactions: [],
    goals: [],
    planningItems: [],
    investments: [],
    investmentTransactions: [],
    investmentGoals: [],
    importBatches: [],
    merchantRules: [],
  };
}

let cache = null;

export function loadDatabase() {
  if (cache) return cache;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === SCHEMA_VERSION) {
        cache = parsed;
        return cache;
      }
    }
  } catch {
    // JSON corrompido ou armazenamento bloqueado: começa limpo em vez de travar a tela.
  }

  cache = emptyDatabase();
  saveDatabase();
  return cache;
}

export function saveDatabase() {
  if (!cache) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (err) {
    // Cota estourada ou navegação privada. Falhar em silêncio esconderia perda de dados.
    throw fail(
      'Não foi possível salvar no navegador. Verifique se o armazenamento do site está liberado.',
      507,
    );
  }
}

/** Aplica uma mudança e persiste, devolvendo o que o handler retornou. */
export function mutate(fn) {
  const db = loadDatabase();
  const result = fn(db);
  saveDatabase();
  return result;
}

export function exportDatabase() {
  return JSON.stringify(loadDatabase(), null, 2);
}

export function importDatabase(json) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.accounts)) {
    throw fail('Arquivo de backup inválido.', 400);
  }
  cache = { ...emptyDatabase(), ...parsed, version: SCHEMA_VERSION };
  saveDatabase();
  return cache;
}

export function resetDatabase() {
  cache = emptyDatabase();
  saveDatabase();
  return cache;
}
