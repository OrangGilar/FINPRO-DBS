# FINPRO-DBS — NBA Leaderboard

A real-time NBA player leaderboard built on two NoSQL databases used for the
jobs each is actually good at. **MongoDB** holds the rich per-player and
per-season documents; **Redis** holds five sorted sets (one per stat) that
serve ranked reads in O(log N) without ever touching Mongo on the hot path.

> Final group project for **Database System and Laboratory (ENCE614016)**,
> Universitas Indonesia · May 2026.

---

## Why two databases

A leaderboard has two demands a single store can't satisfy cheaply:

| Demand | Right tool | Why |
|---|---|---|
| "Top 20 scorers, sorted" | Redis sorted set | `ZREVRANGE` returns ranked entries in O(log N + M). No scan, no sort. |
| "Show Jokić's full stats" | MongoDB document | Nested team, percentages, splits. One indexed lookup. |
| "Update one player's score and re-rank" | Both | Mongo upsert + one `ZADD` to each affected ZSET. Rank changes propagate instantly. |

We treat **MongoDB as the source of truth** and **Redis as a derived projection** of ranking-relevant fields. If Redis dies we rebuild from Mongo in one pass; the reverse isn't true. That asymmetry is the whole design.

---


**Read path** (the user opens the leaderboard):
1. Browser → `GET /api/leaderboard/pts?season=2024&limit=20`
2. Express → `ZREVRANGE lb:pts:season:2024 0 19 WITHSCORES` → 20 player IDs + scores
3. Express → `Player.find({ _id: { $in: ids } })` → 20 player documents
4. Merge and return ranked JSON

**Write path** (admin ingests the CSV):
1. POST `/api/admin/ingest/csv-stats` with the filename
2. `csvIngestion.js` parses, normalizes names, computes deterministic player IDs
3. `Player.bulkWrite` + `SeasonStats.bulkWrite` to Mongo (idempotent upserts)
4. Pipeline `ZADD` to all five Redis ZSETs for each player

---

## Tech stack

| Tier | Choice | Role |
|---|---|---|
| **Data — A** | MongoDB 7 (via Mongoose 8) | Player & SeasonStats documents |
| **Data — B** | Redis 7 (via ioredis 5) | 5 sorted sets — one per stat per season |
| **Backend** | Node.js + Express 4 | HTTP layer, admin-key middleware |
| **Frontend** | React 19 + Vite 8 | Tabbed leaderboard UI, player detail modal |
| **Ingest** | `csv-parse` 5 | Streaming CSV with auto-detected delimiter |
| **Infra** | Docker Compose | One-command stack: Mongo + Redis + backend + frontend |

---

## Data sources

- **NbaData.csv** — 2024–25 per-game player stats from
  [Basketball Reference](https://www.basketball-reference.com/leagues/NBA_2025_per_game.html),
  exported as semicolon-delimited CSV. Lives at `backend/data/NbaData.csv` (~760 rows)..

---

## Project structure

​```
.
├── backend/
│   ├── data/NbaData.csv          # 2024–25 stats (committed)
│   ├── src/
│   │   ├── config/{mongo,redis}.js
│   │   ├── middleware/requireAdminKey.js
│   │   ├── models/{Player,SeasonStats,Game}.js
│   │   ├── routes/{leaderboard,players,admin}.js
│   │   └── service/{Leaderboard,csvIngestion}.js
│   ├── server.js
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # tabs, table, modal, search
│   │   ├── api.js                # centralized client w/ X-Admin-Key handling
│   │   ├── main.jsx              # React mount
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js            # dev proxy → backend
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml            # the easy way to run everything
└── README.md                     # this file
​```

---

## Quick start (Docker — recommended)

Requires Docker Desktop. From the repo root:

​```bash
docker compose up --build
​```

Wait until you see:

​```
backend-1   | [mongo] connected
backend-1   | [redis] connected
backend-1   | [server] listening on http://localhost:3000
frontend-1  |   ➜  Local:   http://localhost:5173/
​```

Then **seed the database** (one-time, while the stack is running):

​```bash
# macOS / Linux
curl -X POST http://localhost:3000/api/admin/ingest/csv-stats \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: FINPRO" \
  -d '{"season": 2024, "filename": "NbaData.csv"}'
​```

​```powershell
# Windows PowerShell — note curl.exe, single line, escaped quotes
curl.exe -X POST http://localhost:3000/api/admin/ingest/csv-stats -H "Content-Type: application/json" -H "X-Admin-Key: FINPRO" -d '{\"season\": 2024, \"filename\": \"NbaData.csv\"}'
​```

Expected response:

​```json
{ "season": 2024, "csv_rows": 760, "players_upserted": 570, "stats_written": 570 }
​```

Open **http://localhost:5173** — the leaderboard's live.

---

## Local development (without Docker)

Useful if you want hot-reload on the backend too. You'll need MongoDB and Redis
running locally (`brew install mongodb-community redis` on macOS,
`apt install mongodb redis-server` on Linux, or Docker Desktop just for those two).

​```bash
# Terminal 1 — backend
cd backend
npm install
npm run dev                   # auto-reloads on save (node --watch)

# Terminal 2 — frontend
cd frontend
npm install
npm run dev                   # http://localhost:5173

# Terminal 3 — seed (once)
curl -X POST http://localhost:3000/api/admin/ingest/csv-stats \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: FINPRO" \
  -d '{"season": 2024, "filename": "NbaData.csv"}'
​```

### Backend environment variables

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/finpro` | Mongo connection string |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection string |
| `ADMIN_KEY` | *(unset → dev bypass)* | Required header value on all `/api/admin/*` routes |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated list of allowed origins |

### Frontend environment variables

| Variable | Default | What it does |
|---|---|---|
| `VITE_BACKEND_URL` | `http://localhost:3000` | Where Vite's dev proxy forwards `/api/*` (local dev) |
| `BACKEND_URL` | — | Same as above but read from `process.env` (used by docker-compose) |
| `VITE_ADMIN_KEY` | *(empty)* | Sent as `X-Admin-Key` on admin requests from the browser. ⚠ shipped to client. |

---

## API reference

### Public endpoints

| Method | Path | Description |
|---|---|---|
| `GET`  | `/api/health` | Liveness check |
| `GET`  | `/api/leaderboard/:metric?season=2024&limit=20` | Top-N for `metric` ∈ {`pts`, `reb`, `ast`, `stl`, `blk`} |
| `GET`  | `/api/players?q=&team_id=&page=1&limit=20` | Search/list players |
| `GET`  | `/api/players/:id` | One player document |
| `GET`  | `/api/players/:id/stats?season=2024` | Season stats for one player |
| `GET`  | `/api/players/:id/rank?season=2024&metric=pts` | A player's rank for one metric |

### Admin endpoints (require `X-Admin-Key`)

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/api/admin/ingest/csv-stats` | `{ "season": 2024, "filename": "NbaData.csv" }` | Re-ingest from a CSV in `backend/data/` |
| `POST` | `/api/admin/leaderboard/flush` | `{ "season": 2024 }` | Drop all Redis ZSETs for a season |

---

## Data models

### MongoDB — `players`

​```js
{
  _id:        1747919115,          // deterministic hash of normalized name
  first_name: "Nikola",
  last_name:  "Jokić",
  position:   "C",
  team: {
    id:           0,
    abbreviation: "DEN",
    full_name:    "Denver Nuggets"
  },
  updated_at: ISODate("2026-05-13T...")
}
​```

Index: `{ _id: 1 }` (built-in, unique).

### MongoDB — `seasonstats`

​```js
{
  player_id:    1747919115,
  season:       2024,
  games_played: 70,
  min:          "36.7",
  pts: 29.6, reb: 12.7, ast: 10.2,
  stl:  1.8, blk:  0.6,
  turnover: 3.6,
  fg_pct: .576, fg3_pct: .417, ft_pct: .800,
  updated_at: ISODate("...")
}
​```

Index: `{ player_id: 1, season: 1 }` — compound unique, prevents duplicates.

### Redis — sorted sets

​```
KEY:    lb:{metric}:season:{season}     e.g. lb:pts:season:2024
SCORE:  the stat value (e.g. 29.6)
MEMBER: the player_id (as string)
​```

Five keys per season — one for each of `pts`, `reb`, `ast`, `stl`, `blk`.

Operations used:
- `ZADD lb:pts:season:2024 29.6 "1747919115"` — write/upsert one stat
- `ZREVRANGE lb:pts:season:2024 0 19 WITHSCORES` — read top 20
- `ZREVRANK lb:pts:season:2024 "1747919115"` — find one player's rank
- `DEL lb:*:season:2024` — flush a whole season

---

## Troubleshooting

**Leaderboard says "No data found"** — the table is empty. Run the seeding curl
from "Quick start." If you already did, check the search box at the top isn't
filtering out everything.

**`HTTP 502 Bad Gateway` in the leaderboard error state** — the frontend
container can't reach the backend. Make sure `docker compose up` shows backend
as healthy. If running locally without Docker, check
`http://localhost:3000/api/health` returns 200.

**`401 Unauthorized — invalid or missing X-Admin-Key`** — the `ADMIN_KEY` env
var on the backend doesn't match the header you sent. Default in compose is
`FINPRO`; override with `ADMIN_KEY=yourkey docker compose up`.

**Frontend shows blank page in Docker** — the `main.jsx` file might be named
`Main.jsx` (capital M). On Linux containers that breaks the import in
`index.html`. Rename with `git mv Main.jsx temp.jsx && git mv temp.jsx main.jsx`.

**MongoDB connection hangs from campus Wi-Fi** — Atlas SRV DNS lookups are
sometimes blocked on university networks. Use the direct shard connection
string from Atlas instead of the `mongodb+srv://` one.

---

## Team

| Member | Student ID | Role |
|---|---|---|
| Muhammad Fairuz dzaki |2406368864| Backend, data models, CSV ingestion |
| Raihan Herhumadzib | [NPM] | Frontend (React, Vite), UI/UX |
| Muhammad Naufal gilardino | [NPM] | DevOps (Docker), benchmarks, slide deck |

---

## Acknowledgments

- **Basketball Reference** for the per-game stats CSV (2024–25 season).
- **AI tooling disclosure** — Claude (Anthropic) was used to help draft
  documentation, debug ingestion edge cases (BOM, delimiter detection),
  and review code. All code was read, tested, and verified by us; we can
  explain any part of the project during Q&A.
