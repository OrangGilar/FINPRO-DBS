const express = require('express');
const requireAdminKey = require('../middleware/requireAdminKey');
const leaderboard = require('../service/Leaderboard');
const csvIngestion = require('../service/csvIngestion');

const router = express.Router();

router.use(requireAdminKey);

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
  } catch (err) { next(err); }
});

router.post('/leaderboard/flush', async (req, res, next) => {
  try {
    const { season } = req.body || {};
    if (!Number.isFinite(season)) {
      return res.status(400).json({ error: 'season is required and must be a number' });
    }
    await leaderboard.flushSeason(season);
    res.json({ flushed: true, season });
  } catch (err) { next(err); }
});

module.exports = router;