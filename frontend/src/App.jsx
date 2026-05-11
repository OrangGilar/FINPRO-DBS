import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:3000/api'

const METRICS = [
  { key: 'pts', label: 'Points' },
  { key: 'reb', label: 'Rebounds' },
  { key: 'ast', label: 'Assists' },
  { key: 'stl', label: 'Steals' },
  { key: 'blk', label: 'Blocks' },
]

const SEASONS = [
  { value: 2024, label: '2024–25' },
  { value: 2023, label: '2023–24' },
  { value: 2022, label: '2022–23' },
  { value: 2021, label: '2021–22' },
]

function rankColor(rank) {
  if (rank === 1) return '#fdb927'
  if (rank === 2) return '#c0c0c0'
  if (rank === 3) return '#cd7f32'
  return '#9a7070'
}

export default function App() {
  const [metric, setMetric] = useState('pts')
  const [season, setSeason] = useState(2024)
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)     

  useEffect(() => {
    fetchLeaderboard()
  }, [metric, season])

  async function fetchLeaderboard() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/leaderboard?metric=${metric}&season=${season}&limit=20`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const data = (json.data || []).map(e => ({
        ...e,
        _name: e.player
          ? `${e.player.first_name} ${e.player.last_name}`
          : `Player #${e.player_id}`
      }))
      setRows(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function openModal(entry) {
    setModal({ entry, stats: null, loading: true })
    try {
      const res = await fetch(`${API_BASE}/players/${entry.player_id}/stats?season=${season}`)
      const json = await res.json()
      setModal({ entry, stats: json.data?.[0] || {}, loading: false })
    } catch {
      setModal({ entry, stats: {}, loading: false })
    }
  }

  const filtered = search
    ? rows.filter(r => r._name.toLowerCase().includes(search.toLowerCase()))
    : rows

  return (
    <>
      <header className="header">
        <div className="logo">🏀 NBA <span>Leaderboard</span></div>
        <div className="season-badge">{season} SEASON</div>
      </header>

      <main className="main">
        <div className="section-title">Stats Category</div>

        <div className="tabs">
          {METRICS.map(m => (
            <button
               key={m.key}
               className={`tab${metric === m.key ? ' active' : ''}`}
              onClick={() => setMetric(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="controls">
          <div className="search-wrap">
            <input
            type="text"
            placeholder="Search a player..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="season-select"
            value={season}
            onChange={e => setSeason(Number(e.target.value))}
          >
            {SEASONS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Team</th>
                <th>Pos</th>
                <th className="num">{metric.toUpperCase()}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="state-msg"><span className="spinner" /> Loading...</td></tr>
              ) : error ? (
                <tr><td colSpan={5} className="state-msg"> {error}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="state-msg">No data found</td></tr>
              ) : filtered.map((e, i) => (
                <tr key={e.player_id} onClick={() => openModal(e)}>
                    <td className="rank-cell" style={{ color: rankColor(e.rank) }}>{e.rank}</td>
                    <td><div className="player-name">{e._name}</div></td>
                    <td><span className="team-badge">{e.player?.team?.abbreviation || '—'}</span></td>
                    <td className="pos-cell">{e.player?.position || '—'}</td>
                    <td className="num">{e.value.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <footer className="footer">
        NBA Leaderboard — FINPRO-DBS &nbsp;|&nbsp; Data via <span>balldontlie API</span>
      </footer>

      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="modal">
            <button className="modal-close" onClick={() => setModal(null)}>×</button>
            <div className="modal-name">{modal.entry._name}</div>
            <div className="modal-sub">
              {[
                modal.entry.player?.team?.full_name,
                modal.entry.player?.position,
                modal.entry.player?.country
              ].filter(Boolean).join(' · ')}
            </div>

            {modal.loading ? (
              <div className="state-msg"><span className="spinner" /> Loading stats...</div>
            ) : (
              <div className="stats-grid">
                {[
                  { val: modal.stats?.pts?.toFixed(1) ?? '—', lbl: 'Points' },
                  { val: modal.stats?.reb?.toFixed(1) ?? '—', lbl: 'Rebounds' },
                  { val: modal.stats?.ast?.toFixed(1) ?? '—', lbl: 'Assists' },
                  { val: modal.stats?.stl?.toFixed(1) ?? '—', lbl: 'Steals' },
                  { val: modal.stats?.blk?.toFixed(1) ?? '—', lbl: 'Blocks' },
                  { val: modal.stats?.games_played ?? '—',    lbl: 'Games' },
                ].map(s => (
                  <div key={s.lbl} className="stat-box">
                    <div className="stat-val">{s.val}</div>
                    <div className="stat-lbl">{s.lbl}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}