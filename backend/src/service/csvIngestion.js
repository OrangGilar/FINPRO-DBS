const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parse } = require('csv-parse/sync');
const Player = require('../models/Player');
const SeasonStats = require('../models/SeasonStats');
const leaderboard = require('./Leaderboard');

// Basketball Reference per-game CSV column names → SeasonStats fields.
const STAT_COLS = {
  pts: 'PTS',
  reb: 'TRB',
  ast: 'AST',
  stl: 'STL',
  blk: 'BLK',
  turnover: 'TOV',
  fg_pct: 'FG%',
  fg3_pct: '3P%',
  ft_pct: 'FT%',
  games_played: 'G',
  min: 'MP',
};

function num(v) {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normName(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Deterministic numeric player_id from the normalized name.
// 32-bit hash → fits in a Number, stable across re-imports.
function hashId(str) {
  const h = crypto.createHash('sha1').update(str).digest();
  // Take first 4 bytes, mask to positive 31-bit int (avoids JS BigInt territory).
  return (h.readUInt32BE(0) & 0x7fffffff);
}

function splitName(fullName) {
  const cleaned = fullName.replace(/\*$/, '').trim(); // strip BR's HoF "*"
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return { first_name: '', last_name: parts[0] };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' '),
  };
}

async function ingestStatsFromCsv({ season, filename }) {
  const filepath = path.resolve(__dirname, '../../data', filename);
  if (!fs.existsSync(filepath)) {
    throw new Error(`CSV not found at ${filepath}`);
  }

  let raw = fs.readFileSync(filepath, 'utf8');

  // Strip BOM if present.
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);

  // Drop junk "Column1;Column2;..." header row if present.
  const firstLine = raw.split(/\r?\n/, 1)[0] || '';
  if (/^Column1[;,]/.test(firstLine)) {
    raw = raw.slice(firstLine.length).replace(/^\r?\n/, '');
  }

  // Auto-detect delimiter.
  const headerLine = raw.split(/\r?\n/, 1)[0] || '';
  const delimiter = (headerLine.match(/;/g) || []).length
                  > (headerLine.match(/,/g) || []).length ? ';' : ',';

  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    delimiter,
  });

  // For players traded mid-season, BR has a "TOT" (total) row + one row per team.
  // Sort so TOT rows come first; we keep the first row we see per player.
  const sorted = [...rows].sort((a, b) => {
    const aTot = (a.Team || a.Tm) === 'TOT' ? 0 : 1;
    const bTot = (b.Team || b.Tm) === 'TOT' ? 0 : 1;
    return aTot - bTot;
  });

  const seen = new Set();
  const playerOps = [];
  const statsOps = [];
  const redisProjections = [];

  for (const row of sorted) {
    const fullName = (row.Player || '').replace(/\*$/, '').trim();
    if (!fullName || fullName === 'Player') continue;

    const key = normName(fullName);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const player_id = hashId(key);
    const { first_name, last_name } = splitName(fullName);
    const teamAbbr = row.Team || row.Tm || null;

    // Upsert Player record.
    playerOps.push({
      updateOne: {
        filter: { _id: player_id },
        update: {
          $set: {
            _id: player_id,
            first_name,
            last_name,
            position: row.Pos || null,
            // Minimal team subdoc — we only have the abbreviation from the CSV.
            team: teamAbbr ? { id: 0, full_name: teamAbbr, abbreviation: teamAbbr } : null,
            updated_at: new Date(),
          },
        },
        upsert: true,
      },
    });

    const stats = {
      player_id,
      season,
      games_played: num(row[STAT_COLS.games_played]),
      min: row[STAT_COLS.min] || null,
      pts: num(row[STAT_COLS.pts]),
      reb: num(row[STAT_COLS.reb]),
      ast: num(row[STAT_COLS.ast]),
      stl: num(row[STAT_COLS.stl]),
      blk: num(row[STAT_COLS.blk]),
      turnover: num(row[STAT_COLS.turnover]),
      fg_pct: num(row[STAT_COLS.fg_pct]),
      fg3_pct: num(row[STAT_COLS.fg3_pct]),
      ft_pct: num(row[STAT_COLS.ft_pct]),
      updated_at: new Date(),
    };

    statsOps.push({
      updateOne: {
        filter: { player_id, season },
        update: { $set: stats },
        upsert: true,
      },
    });

    redisProjections.push({ player_id, season, stats });
  }

  // Bulk-write to Mongo first.
  if (playerOps.length) await Player.bulkWrite(playerOps);
  if (statsOps.length) await SeasonStats.bulkWrite(statsOps);

  // Then project to Redis.
  for (const p of redisProjections) {
    await leaderboard.upsertPlayerStats(p);
  }

  return {
    season,
    csv_rows: rows.length,
    players_upserted: playerOps.length,
    stats_written: statsOps.length,
  };
}

module.exports = { ingestStatsFromCsv };