const { getRedis } = require('../config/redis');

const METRICS = ['pts', 'reb', 'ast', 'stl', 'blk'];

function key(metric, season) {
  return `lb:${metric}:season:${season}`;
}

async function upsertPlayerStats({ player_id, season, stats }) {
  const redis = getRedis();
  const pipeline = redis.pipeline();

  for (const m of METRICS) {
    const value = Number(stats[m]);
    if (Number.isFinite(value)) {
      pipeline.zadd(key(m, season), value, String(player_id));
    }
  }
  await pipeline.exec();
}

async function getTop({ metric, season, limit = 10 }) {
  if (!METRICS.includes(metric)) throw new Error(`Invalid metric: ${metric}`);
  const redis = getRedis();
  // ZRANGE REV WITHSCORES → [id1, score1, id2, score2, ...]
  const flat = await redis.zrange(key(metric, season), 0, limit - 1, 'REV', 'WITHSCORES');
  const result = [];
  for (let i = 0; i < flat.length; i += 2) {
    result.push({
      player_id: Number(flat[i]),
      value: Number(flat[i + 1]),
      rank: result.length + 1
    });
  }
  return result;
}

async function getPlayerRank({ metric, season, player_id }) {
  if (!METRICS.includes(metric)) throw new Error(`Invalid metric: ${metric}`);
  const redis = getRedis();
  const k = key(metric, season);
  const [rank, score] = await Promise.all([
    redis.zrevrank(k, String(player_id)),
    redis.zscore(k, String(player_id))
  ]);
  if (rank === null) return null;
  return { rank: rank + 1, value: Number(score) };
}

async function flushSeason(season) {
  const redis = getRedis();
  const pipeline = redis.pipeline();
  for (const m of METRICS) pipeline.del(key(m, season));
  await pipeline.exec();
}

module.exports = {
  METRICS,
  upsertPlayerStats,
  getTop,
  getPlayerRank,
  flushSeason
};