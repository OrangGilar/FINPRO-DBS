const mongoose = require('mongoose');

const SeasonStatsSchema = new mongoose.Schema(
  {
    player_id: { type: Number, required: true },
    season: { type: Number, required: true },
    games_played: Number,
    min: String,
    pts: Number, // points per game
    reb: Number, // rebounds per game
    ast: Number, // assists per game
    stl: Number,
    blk: Number,
    turnover: Number,
    fg_pct: Number,
    fg3_pct: Number,
    ft_pct: Number,
    updated_at: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

SeasonStatsSchema.index({ player_id: 1, season: 1 }, { unique: true });
SeasonStatsSchema.index({ season: 1, pts: -1 });

module.exports = mongoose.model('SeasonStats', SeasonStatsSchema);