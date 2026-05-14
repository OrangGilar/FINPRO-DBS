const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema(
  {
    id: Number,
    full_name: String,
    abbreviation: String,
    conference: String,
    division: String,
    city: String
  },
  { _id: false }
);

const PlayerSchema = new mongoose.Schema(
  {
    _id: { type: Number, required: true },
    first_name: String,
    last_name: String,
    position: String,
    team: TeamSchema,
    updated_at: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

PlayerSchema.index({ last_name: 1, first_name: 1 });
PlayerSchema.index({ 'team.id': 1 });

module.exports = mongoose.model('Player', PlayerSchema);