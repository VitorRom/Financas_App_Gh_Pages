const API_BASE = '/api';

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

async function fetchAPI(endpoint, options = {}) {
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
    const error = await response.json().catch(() => ({ error: 'Erro na requisição' }));
    throw new Error(error.error || 'Request failed');
  }

  if (response.status === 204) return null;
  return response.json();
}

async function postFormData(endpoint, formData) {
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
    const error = await response.json().catch(() => ({ error: 'Erro no envio' }));
    throw new Error(error.error || 'Request failed');
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
  getQuote: (ticker) => fetchAPI(`/market/quote/${ticker}`),
  refreshAll: () => fetchAPI('/market/refresh-all', { method: 'POST' }),
  getIndices: () => fetchAPI('/market/indices'),
  getIndexHistory: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/market/index-history${query ? `?${query}` : ''}`);
  },
};
