const Player = require('../models/Player');
const Game = require('../models/Game');
const SeasonStats = require('../models/SeasonStats');
const nbaApi = require('./NbaApi');
const leaderboard = require('./Leaderboard');

/**
 * Ingest player roster into MongoDB.
 * Pages through balldontlie /players endpoint.
 */
async function ingestPlayers({ maxPages = 5 } = {}) {
  let cursor = 0;
  let pages = 0;
  let total = 0;

  while (pages < maxPages) {
    const { data, meta } = await nbaApi.fetchPlayers({ cursor, per_page: 100 });
    if (!data?.length) break;

    const ops = data.map((p) => ({
      updateOne: {
        filter: { _id: p.id },
        update: {
          $set: {
            _id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            position: p.position,
            height: p.height,
            weight: p.weight,
            jersey_number: p.jersey_number,
            college: p.college,
            country: p.country,
            draft_year: p.draft_year,
            draft_round: p.draft_round,
            draft_number: p.draft_number,
            team: p.team,
            updated_at: new Date()
          }
        },
        upsert: true
      }
    }));
    if (ops.length) await Player.bulkWrite(ops);

    total += data.length;
    pages += 1;
    if (!meta?.next_cursor) break;
    cursor = meta.next_cursor;
  }

  return { players_ingested: total };
}

/**
 * Ingest season averages for a list of players.
 * Persists to MongoDB AND projects to Redis sorted sets.
 */
async function ingestSeasonAverages({ season, player_ids }) {
  if (!player_ids?.length) return { count: 0 };

 
  const chunkSize = 25;
  let count = 0;

  for (let i = 0; i < player_ids.length; i += chunkSize) {
    const chunk = player_ids.slice(i, i + chunkSize);
    const stats = await nbaApi.fetchSeasonAverages({ season, player_ids: chunk });
    if (!stats?.length) continue;

    // 1. Persist to MongoDB (source of truth)
    const ops = stats.map((s) => ({
      updateOne: {
        filter: { player_id: s.player_id, season },
        update: {
          $set: {
            player_id: s.player_id,
            season,
            games_played: s.games_played,
            min: s.min,
            pts: s.pts,
            reb: s.reb,
            ast: s.ast,
            stl: s.stl,
            blk: s.blk,
            turnover: s.turnover,
            fg_pct: s.fg_pct,
            fg3_pct: s.fg3_pct,
            ft_pct: s.ft_pct,
            updated_at: new Date()
          }
        },
        upsert: true
      }
    }));
    await SeasonStats.bulkWrite(ops);

    // 2. Project to Redis (derived leaderboard)
    for (const s of stats) {
      await leaderboard.upsertPlayerStats({
        player_id: s.player_id,
        season,
        stats: s
      });
    }

    count += stats.length;
  }

  return { season_stats_ingested: count };
}


async function ingestGames({ season, maxPages = 3 } = {}) {
  let cursor = 0;
  let pages = 0;
  let total = 0;

  while (pages < maxPages) {
    const { data, meta } = await nbaApi.fetchGames({ season, cursor, per_page: 100 });
    if (!data?.length) break;

    const ops = data.map((g) => ({
      updateOne: {
        filter: { _id: g.id },
        update: {
          $set: {
            _id: g.id,
            date: g.date ? new Date(g.date) : null,
            season: g.season,
            status: g.status,
            period: g.period,
            time: g.time,
            postseason: g.postseason,
            home_team: g.home_team,
            visitor_team: g.visitor_team,
            home_team_score: g.home_team_score,
            visitor_team_score: g.visitor_team_score
          }
        },
        upsert: true
      }
    }));
    if (ops.length) await Game.bulkWrite(ops);

    total += data.length;
    pages += 1;
    if (!meta?.next_cursor) break;
    cursor = meta.next_cursor;
  }

  return { games_ingested: total };
}

/**
 * Full pipeline: roster → games → season stats → leaderboards.
 */
async function runFullIngestion({ season }) {
  const playersResult = await ingestPlayers({ maxPages: 3 });
  const gamesResult = await ingestGames({ season, maxPages: 2 });

  // Pick a sample of player IDs we just stored
  const players = await Player.find({}, { _id: 1 }).limit(150).lean();
  const ids = players.map((p) => p._id);
  const statsResult = await ingestSeasonAverages({ season, player_ids: ids });

  return { ...playersResult, ...gamesResult, ...statsResult, season };
}

module.exports = {
  ingestPlayers,
  ingestSeasonAverages,
  ingestGames,
  runFullIngestion
};