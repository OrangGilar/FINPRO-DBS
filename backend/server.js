require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { connectMongo } = require('./src/config/mongo');
const { connectRedis } = require('./src/config/redis');
const { startScheduler } = require('./workers/scheduler');

const playersRoute = require('./src/routes/players');
const leaderboardRoute = require('./src/routes/leaderboard');
const adminRoute = require('./src/routes/admin');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/players', playersRoute);
app.use('/api/leaderboard', leaderboardRoute);
app.use('/api/admin', adminRoute);

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await connectMongo();
    await connectRedis();

    if (process.env.ENABLE_SCHEDULER === 'true') {
      startScheduler();
    }

    app.listen(PORT, () => {
      console.log(`[server] listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[startup] failed:', err);
    process.exit(1);
  }
})();