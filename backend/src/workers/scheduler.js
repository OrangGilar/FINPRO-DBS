const cron = require('node-cron');
const ingestion = require('../service/ingestion');

function startScheduler() {
  const season = Number(process.env.SEASON);
  if (!Number.isFinite(season)) {
    console.warn('[scheduler] SEASON env var not set or invalid — scheduler disabled');
    return;
  }

  // Every 6 hours: refresh season averages + games
  cron.schedule('0 */6 * * *', async () => {
    console.log('[scheduler] running periodic ingestion');
    try {
      await ingestion.runFullIngestion({ season });
      console.log('[scheduler] done');
    } catch (err) {
      console.error('[scheduler] failed', err.message);
    }
  });

  console.log('[scheduler] started — every 6h');
}

module.exports = { startScheduler };