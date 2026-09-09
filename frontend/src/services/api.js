import { handleStandaloneRequest } from './standalone/backend.js';

/**
 * Modo autônomo: a aplicação roda inteira no navegador, sem API e sem login, com os
 * dados guardados localmente. É o que permite publicar em hospedagem estática como o
 * GitHub Pages. Ligado por VITE_STANDALONE no build.
 */
export const STANDALONE = import.meta.env.VITE_STANDALONE === 'true';

/**
 * Em desenvolvimento fica vazio e o proxy do Vite encaminha /api para localhost:3001.
 * Publicado com API própria, VITE_API_URL aponta para a URL pública dela.
 */
const API_BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api`;

export const AUTH_TOKEN_KEY = 'financas_auth_token';

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
}

function buildHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function isAuthPublicEndpoint(endpoint) {
  return (
    endpoint.startsWith('/auth/login') ||
    endpoint.startsWith('/auth/register') ||
    endpoint.startsWith('/subscriptions/plans')
  );
}

/**
 * Mensagem de erro a partir da resposta.
 *
 * Quando o corpo não é JSON, a API não chegou a responder: normalmente é rota
 * inexistente ou servidor fora do ar. Antes isso virava um "Erro na requisição"
 * sem pista nenhuma — a mensagem agora diz o que aconteceu.
 */
async function errorMessageFrom(response, endpoint, method = 'GET') {
  const body = await response.json().catch(() => null);
  if (body?.error) return body.error;

  if (response.status === 404) {
    return `Recurso não encontrado no servidor (${method} ${endpoint}). ` +
      'Se a aplicação foi atualizada, reinicie o servidor da API.';
  }
  if (response.status >= 500) return 'O servidor falhou ao processar. Tente de novo em instantes.';
  return `Falha na comunicação com o servidor (HTTP ${response.status}).`;
}

async function fetchAPI(endpoint, options = {}) {
  if (STANDALONE) return handleStandaloneRequest(endpoint, options);

  const headers = buildHeaders({
    'Content-Type': 'application/json',
    ...options.headers,
  });

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (
      response.status === 401 &&
      !isAuthPublicEndpoint(endpoint) &&
      getAuthToken()
    ) {
      setAuthToken(null);
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }
    throw new Error(await errorMessageFrom(response, endpoint, options.method));
  }

  if (response.status === 204) return null;
  return response.json();
}

async function postFormData(endpoint, formData) {
  if (STANDALONE) return handleStandaloneRequest(endpoint, { method: 'POST' });

  const headers = buildHeaders();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && getAuthToken()) {
      setAuthToken(null);
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }
    throw new Error(await errorMessageFrom(response, endpoint, 'POST'));
  }

  return response.json();
}

// Auth
export const authAPI = {
  register: (body) =>
    fetchAPI('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) =>
    fetchAPI('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => fetchAPI('/auth/me'),
  updateProfile: (body) =>
    fetchAPI('/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),
  changePassword: (body) =>
    fetchAPI('/auth/password', { method: 'PUT', body: JSON.stringify(body) }),
  completeOnboarding: () => fetchAPI('/auth/onboarding/complete', { method: 'POST' }),
};

// Assinaturas
export const subscriptionsAPI = {
  getPlans: () => fetchAPI('/subscriptions/plans'),
  getCurrent: () => fetchAPI('/subscriptions'),
  subscribe: (body) =>
    fetchAPI('/subscriptions/subscribe', { method: 'POST', body: JSON.stringify(body) }),
  cancel: () => fetchAPI('/subscriptions/cancel', { method: 'POST' }),
};

// Transactions
export const transactionsAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/transactions${query ? `?${query}` : ''}`);
  },
  getById: (id) => fetchAPI(`/transactions/${id}`),
  create: (data) => fetchAPI('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => fetchAPI(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => fetchAPI(`/transactions/${id}`, { method: 'DELETE' }),
};

// Categories
export const categoriesAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/categories${query ? `?${query}` : ''}`);
  },
  getById: (id) => fetchAPI(`/categories/${id}`),
  create: (data) => fetchAPI('/categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => fetchAPI(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => fetchAPI(`/categories/${id}`, { method: 'DELETE' }),
};

// Accounts
export const accountsAPI = {
  getAll: () => fetchAPI('/accounts'),
  getById: (id) => fetchAPI(`/accounts/${id}`),
  create: (data) => fetchAPI('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => fetchAPI(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => fetchAPI(`/accounts/${id}`, { method: 'DELETE' }),
};

// Dashboard
export const dashboardAPI = {
  getSummary: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/dashboard/summary${query ? `?${query}` : ''}`);
  },
  getMonthlyData: (year) => fetchAPI(`/dashboard/monthly?year=${year}`),
};

export const importsAPI = {
  importStatement: ({ file, accountId }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', accountId);
    return postFormData('/import/statement', formData);
  },
};

export const rulesAPI = {
  applyFromTransaction: ({ transactionId, categoryId, scope = 'all' }) =>
    fetchAPI(`/rules/from-transaction/${transactionId}`, {
      method: 'POST',
      body: JSON.stringify({ categoryId, scope }),
    }),
};

export const maintenanceAPI = {
  purge: ({ range, startDate, endDate, accountId }) =>
    fetchAPI('/maintenance/purge', {
      method: 'POST',
      body: JSON.stringify({ range, startDate, endDate, accountId }),
    }),
};

export const importBatchesAPI = {
  list: ({ accountId } = {}) => fetchAPI(`/import/batches${accountId ? `?accountId=${accountId}` : ''}`),
  delete: (id) => fetchAPI(`/import/batches/${id}`, { method: 'DELETE' }),
};

export const goalsAPI = {
  list: () => fetchAPI('/goals'),
  create: (data) => fetchAPI('/goals', { method: 'POST', body: JSON.stringify(data) }),
  updateInstallment: (id, data) => fetchAPI(`/goals/installments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id) => fetchAPI(`/goals/${id}`, { method: 'DELETE' }),
};

export const planningAPI = {
  list: () => fetchAPI('/planning'),
  create: (data) => fetchAPI('/planning', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => fetchAPI(`/planning/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => fetchAPI(`/planning/${id}`, { method: 'DELETE' }),
};

// Investimentos
export const investmentsAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/investments${query ? `?${query}` : ''}`);
  },
  getById: (id) => fetchAPI(`/investments/${id}`),
  create: (data) => fetchAPI('/investments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => fetchAPI(`/investments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => fetchAPI(`/investments/${id}`, { method: 'DELETE' }),
  refreshPrice: (id) => fetchAPI(`/investments/${id}/refresh-price`, { method: 'POST' }),
  getSummary: () => fetchAPI('/investments/summary'),
  getEvolution: (months = 12) => fetchAPI(`/investments/evolution?months=${months}`),
  getAllocation: () => fetchAPI('/investments/allocation'),
  getDividends: (year) => fetchAPI(`/investments/dividends?year=${year}`),
  getTransactions: (id) => fetchAPI(`/investments/${id}/transactions`),
  createTransaction: (id, data) => fetchAPI(`/investments/${id}/transactions`, { method: 'POST', body: JSON.stringify(data) }),
};

// Transações de Investimento (update/delete avulsos)
export const investmentTransactionsAPI = {
  update: (id, data) => fetchAPI(`/investment-transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => fetchAPI(`/investment-transactions/${id}`, { method: 'DELETE' }),
};

// Metas de Investimento
export const investmentGoalsAPI = {
  getAll: () => fetchAPI('/investment-goals'),
  create: (data) => fetchAPI('/investment-goals', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => fetchAPI(`/investment-goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => fetchAPI(`/investment-goals/${id}`, { method: 'DELETE' }),
  getProjection: (id) => fetchAPI(`/investment-goals/${id}/projection`),
};

// Cotações e Índices
export const marketAPI = {
  // `assetType` é o que permite a API buscar título do Tesouro no Tesouro
  // Transparente em vez da BrAPI, que não conhece esses papéis.
  getQuote: (ticker, assetType) =>
    fetchAPI(`/market/quote/${ticker}${assetType ? `?assetType=${assetType}` : ''}`),
  refreshAll: () => fetchAPI('/market/refresh-all', { method: 'POST' }),
  getIndices: () => fetchAPI('/market/indices'),
  // Catálogo do Tesouro Direto para o usuário escolher o título exato: indexador +
  // vencimento não bastam, porque oito vencimentos têm versão com e sem juros semestrais.
  getTreasuryTitles: () => fetchAPI('/market/treasury'),
  getIndexHistory: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/market/index-history${query ? `?${query}` : ''}`);
  },
};
