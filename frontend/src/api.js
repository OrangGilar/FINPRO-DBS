const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || ''

class ApiError extends Error {
  constructor(message, { status, url, body } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.url = url
    this.body = body
  }
}

async function request(path, { method = 'GET', query, body, admin = false } = {}) {
  const url = new URL(
    path.replace(/^\//, ''),
    // URL needs a base; if API_BASE is relative ("/api"), resolve against window.
    API_BASE.startsWith('http') ? API_BASE + '/' : window.location.origin + API_BASE + '/'
  )

  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, v)
      }
    }
  }

  const headers = { 'Content-Type': 'application/json' }
  if (admin) {
    if (!ADMIN_KEY) {
      throw new ApiError(
        'Admin endpoint requested but VITE_ADMIN_KEY is not configured',
        { url: url.toString() }
      )
    }
    headers['X-Admin-Key'] = ADMIN_KEY
  }

  let res
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  // eslint-disable-next-line no-unused-vars
  } catch (err) {
    // Network-level failure (backend down, DNS, CORS preflight blocked, etc.)
    throw new ApiError(
      `Network error reaching ${url} — is the backend running?`,
      { url: url.toString() }
    )
  }

  let payload = null
  const text = await res.text()
  if (text) {
    try { payload = JSON.parse(text) } catch { payload = text }
  }

  if (!res.ok) {
    const msg = (payload && payload.error) || `HTTP ${res.status} ${res.statusText}`
    throw new ApiError(msg, { status: res.status, url: url.toString(), body: payload })
  }

  return payload
}

// ---- Public endpoints (no key needed) ----

export const api = {
  health: () => request('health'),

  getLeaderboard: ({ metric, season, limit = 20 }) =>
    request(`leaderboard/${metric}`, { query: { season, limit } }),

  getPlayer: (id) => request(`players/${id}`),

  getPlayerStats: ({ id, season }) =>
    request(`players/${id}/stats`, { query: { season } }),

  getPlayerRank: ({ id, season, metric }) =>
    request(`players/${id}/rank`, { query: { season, metric } }),

  searchPlayers: ({ q, team_id, page = 1, limit = 20 } = {}) =>
    request('players', { query: { q, team_id, page, limit } }),

  // ---- Admin endpoints (require VITE_ADMIN_KEY) ----

  admin: {
    ingestPlayers: ({ maxPages } = {}) =>
      request('admin/ingest/players', { method: 'POST', body: { maxPages }, admin: true }),

    ingestGames: ({ season, maxPages } = {}) =>
      request('admin/ingest/games', { method: 'POST', body: { season, maxPages }, admin: true }),

    ingestSeasonAverages: ({ season, player_ids }) =>
      request('admin/ingest/season-averages', {
        method: 'POST', body: { season, player_ids }, admin: true,
      }),

    runFullIngestion: ({ season }) =>
      request('admin/ingest/full', { method: 'POST', body: { season }, admin: true }),

    flushLeaderboard: ({ season }) =>
      request('admin/leaderboard/flush', { method: 'POST', body: { season }, admin: true }),
  },
}

export { ApiError, API_BASE }