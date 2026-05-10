const express = require('express');
const Player = require('../models/Player');
const SeasonStats = require('../models/SeasonStats');
const leaderboard = require('../service/Leaderboard');

const router = express.Router();

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

router.get('/', async (req, res) => {
  const { q, team_id } = req.query;
  const page = parsePositiveInt(req.query.page, 1);
  const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);

  const filter = {};
  if (q) {
    const rx = new RegExp('^' + escapeRegex(String(q)), 'i');
    filter.$or = [{ first_name: rx }, { last_name: rx }];
  }
  if (team_id) {
    const tid = Number.parseInt(team_id, 10);
    if (!Number.isFinite(tid)) {
      return res.status(400).json({ error: 'team_id must be a number' });
    }
    filter['team.id'] = tid;
  }

  const [items, total] = await Promise.all([
    Player.find(filter)
      .sort({ last_name: 1, first_name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Player.countDocuments(filter)
  ]);

  res.json({ page, limit, total, items });
});

router.get('/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'id must be a number' });
  }
  const player = await Player.findById(id).lean();
  if (!player) return res.status(404).json({ error: 'Player not found' });
  res.json(player);
});

router.get('/:id/stats', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const season = Number.parseInt(req.query.season, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'id must be a number' });
  }
  if (!Number.isFinite(season)) {
    return res.status(400).json({ error: 'season query param is required and must be a number' });
  }
  const stats = await SeasonStats.findOne({ player_id: id, season }).lean();
  if (!stats) return res.status(404).json({ error: 'Season stats not found' });
  res.json(stats);
});

router.get('/:id/rank', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const season = Number.parseInt(req.query.season, 10);
  const metric = req.query.metric;

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'id must be a number' });
  }
  if (!Number.isFinite(season)) {
    return res.status(400).json({ error: 'season query param is required and must be a number' });
  }
  if (!leaderboard.METRICS.includes(metric)) {
    return res.status(400).json({ error: `metric must be one of: ${leaderboard.METRICS.join(', ')}` });
  }

  const result = await leaderboard.getPlayerRank({ metric, season, player_id: id });
  if (!result) return res.status(404).json({ error: 'Player not on leaderboard for this metric/season' });
  res.json({ player_id: id, metric, season, ...result });
});

module.exports = router;
