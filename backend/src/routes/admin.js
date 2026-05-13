const express = require('express');
const requireAdminKey = require('../middleware/requireAdminKey');
const ingestion = require('../service/ingestion');
const leaderboard = require('../service/Leaderboard');
const csvIngestion = require('../service/csvIngestion');

const router = express.Router();

router.use(requireAdminKey);

router.post('/ingest/players', async (req, res) => {
  const { maxPages } = req.body || {};
  const result = await ingestion.ingestPlayers(
    Number.isFinite(maxPages) ? { maxPages } : {}
  );
  res.json(result);
});

router.post('/ingest/games', async (req, res) => {
  const { season, maxPages } = req.body || {};
  if (!Number.isFinite(season)) {
    return res.status(400).json({ error: 'season is required and must be a number' });
  }
  const result = await ingestion.ingestGames({
    season,
    ...(Number.isFinite(maxPages) ? { maxPages } : {})
  });
  res.json(result);
});

router.post('/ingest/season-averages', async (req, res) => {
  const { season, player_ids } = req.body || {};
  if (!Number.isFinite(season)) {
    return res.status(400).json({ error: 'season is required and must be a number' });
  }
  if (!Array.isArray(player_ids) || player_ids.length === 0) {
    return res.status(400).json({ error: 'player_ids is required and must be a non-empty array' });
  }
  if (!player_ids.every((id) => Number.isFinite(id))) {
    return res.status(400).json({ error: 'player_ids must contain only numbers' });
  }
  const result = await ingestion.ingestSeasonAverages({ season, player_ids });
  res.json(result);
});

router.post('/ingest/full', async (req, res) => {
  const { season } = req.body || {};
  if (!Number.isFinite(season)) {
    return res.status(400).json({ error: 'season is required and must be a number' });
  }
  const result = await ingestion.runFullIngestion({ season });
  res.json(result);
});

router.post('/ingest/csv-stats', async (req, res, next) => {
  try {
    const { season, filename } = req.body || {};
    if (!Number.isFinite(season)) {
      return res.status(400).json({ error: 'season is required and must be a number' });
    }
    if (!filename) {
      return res.status(400).json({ error: 'filename is required (e.g. "NbaData.csv")' });
    }
    const result = await csvIngestion.ingestStatsFromCsv({ season, filename });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/leaderboard/flush', async (req, res) => {
  const { season } = req.body || {};
  if (!Number.isFinite(season)) {
    return res.status(400).json({ error: 'season is required and must be a number' });
  }
  await leaderboard.flushSeason(season);
  res.json({ flushed: true, season });
});

module.exports = router;