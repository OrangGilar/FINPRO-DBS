require('dotenv').config();
const { connectMongo } = require('../src/config/mongo');
const { connectRedis } = require('../src/config/redis');
const SeasonStats = require('../src/models/SeasonStats');
const leaderboard = require('../services/leaderboard');

(async () => {
  try {
    await connectMongo();
    await connectRedis();

    const season = Number(process.env.SEASON);
    console.log(`[rebuild] flushing leaderboards for season ${season}`);
    await leaderboard.flushSeason(season);

    const all = await SeasonStats.find({ season }).lean();
    console.log(`[rebuild] projecting ${all.length} player stats to Redis`);

    for (const s of all) {
      await leaderboard.upsertPlayerStats({
        player_id: s.player_id,
        season,
        stats: s
      });
    }

    console.log('[rebuild] done');
    process.exit(0);
  } catch (err) {
    console.error('[rebuild] failed', err);
    process.exit(1);
  }
})();