import "dotenv/config";
import express from "express";
import { connectMongo } from "./src/config/db.js";

// Route modules
import playerRoutes      from "./src/routes/players.js";
import leaderboardRoutes from "./src/routes/leaderboard.js";
import ingestRoutes      from "./src/routes/ingest.js";

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/players",     playerRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/ingest",      ingestRoutes);

// Health check
app.get("/", (_req, res) => {
  res.json({
    service:   "NBA Leaderboard & Player Stat Tracker",
    group:     "Group E",
    version:   "1.0.0",
    endpoints: {
      players:     "/api/players",
      leaderboard: "/api/leaderboard",
      ingest:      "/api/ingest",
    },
  });
});

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  await connectMongo();         // connect MongoDB first
  // Redis connects automatically via ioredis on import

  app.listen(PORT, () => {
    console.log(`\n🏀 NBA Tracker API running → http://localhost:${PORT}`);
    console.log(`   MongoDB  : ${process.env.MONGO_URI}`);
    console.log(`   Redis    : ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}\n`);
  });
}

start();