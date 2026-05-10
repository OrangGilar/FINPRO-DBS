const express = require('express');
const Player = require('../models/Player');
const leaderboard = require('../service/Leaderboard');

const router = express.Router();

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

router.get('/:metric', async (req, res) => {
  const { metric } = req.params;
  const season = Number.parseInt(req.query.season, 10);
  const limit = Math.min(parsePositiveInt(req.query.limit, 10), 100);

  if (!leaderboard.METRICS.includes(metric)) {
    return res.status(400).json({ error: `metric must be one of: ${leaderboard.METRICS.join(', ')}` });
  }
  if (!Number.isFinite(season)) {
    return res.status(400).json({ error: 'season query param is required and must be a number' });
  }

  const ranked = await leaderboard.getTop({ metric, season, limit });
  if (!ranked.length) {
    return res.json({ metric, season, limit, items: [] });
  }

  const ids = ranked.map((r) => r.player_id);
  const players = await Player.find({ _id: { $in: ids } }).lean();
  const byId = new Map(players.map((p) => [p._id, p]));

  const items = ranked.map((r) => {
    const p = byId.get(r.player_id);
    return {
      rank: r.rank,
      player_id: r.player_id,
      value: r.value,
      first_name: p?.first_name ?? null,
      last_name: p?.last_name ?? null,
      position: p?.position ?? null,
      team: p?.team
        ? { id: p.team.id, full_name: p.team.full_name, abbreviation: p.team.abbreviation }
        : null
    };
  });

  res.json({ metric, season, limit, items });
});

module.exports = router;
