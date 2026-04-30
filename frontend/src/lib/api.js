const API_KEY = 'demo_key_fraudshield_2024'
const BASE = import.meta.env.VITE_API_URL || ''

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...opts.headers
    }
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export const api = {
  stats:        ()              => apiFetch('/v1/dashboard/stats'),
  alerts:       (params = '')   => apiFetch(`/v1/alerts?${params}`),
  transactions: (params = '')   => apiFetch(`/v1/transactions?${params}`),
  userRisk:     (uid)           => apiFetch(`/v1/user-risk-score/${uid}`),
  resolveAlert: (id)            => apiFetch(`/v1/alerts/${id}/resolve`, { method: 'PATCH' }),
  scoreTest:    (body)          => apiFetch('/v1/transaction', { method: 'POST', body: JSON.stringify(body) }),
}
