const axios = require('axios');

const client = axios.create({
  baseURL: process.env.BDL_BASE_URL || 'https://api.balldontlie.io/v1',
  timeout: 15000,
  headers: process.env.BDL_API_KEY
    ? { Authorization: process.env.BDL_API_KEY }
    : {}
});

async function fetchPlayers({ cursor = 0, per_page = 100 } = {}) {
  const { data } = await client.get('/players', { params: { cursor, per_page } });
  return data; 
}

async function fetchSeasonAverages({ season, player_ids }) {
  // balldontlie accepts multiple player_ids[] params
  const { data } = await client.get('/season_averages', {
    params: { season, 'player_ids[]': player_ids }
  });
  return data.data; // [{ player_id, pts, reb, ast, ... }]
}

async function fetchGames({ season, cursor = 0, per_page = 100 }) {
  const { data } = await client.get('/games', {
    params: { 'seasons[]': season, cursor, per_page }
  });
  return data;
}

async function fetchPlayerStats({ player_id, season, per_page = 25 }) {
  const { data } = await client.get('/stats', {
    params: { 'player_ids[]': player_id, 'seasons[]': season, per_page }
  });
  return data.data;
}

module.exports = {
  fetchPlayers,
  fetchSeasonAverages,
  fetchGames,
  fetchPlayerStats
};