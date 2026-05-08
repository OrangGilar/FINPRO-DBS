const Redis = require('ioredis');

let client;

function getRedis() {
  if (!client) throw new Error('Redis not initialized');
  return client;
}

async function connectRedis() {
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  client = new Redis(url, { maxRetriesPerRequest: 3 });

  client.on('error', (err) => console.error('[redis] error', err.message));

  await client.ping();
  console.log('[redis] connected');
  return client;
}

module.exports = { connectRedis, getRedis };