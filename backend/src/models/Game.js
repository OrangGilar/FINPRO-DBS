const mongoose = require('mongoose');

const GameTeamSchema = new mongoose.Schema(
  { id: Number, full_name: String, abbreviation: String },
  { _id: false }
);

const GameSchema = new mongoose.Schema(
  {
    _id: { type: Number, required: true },
    date: Date,
    season: Number,
    status: String,
    period: Number,
    time: String,
    postseason: Boolean,
    home_team: GameTeamSchema,
    visitor_team: GameTeamSchema,
    home_team_score: Number,
    visitor_team_score: Number
  },
  { versionKey: false }
);

GameSchema.index({ season: 1, date: -1 });

module.exports = mongoose.model('Game', GameSchema);