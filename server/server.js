/**
 * Main entry point for the Blood on the Clocktower tracker API.
 *
 * Boot sequence:
 *   1. Load environment variables
 *   2. Import database (tables auto-created on import)
 *   3. Run seed (idempotent)
 *   4. Configure Express middleware
 *   5. Mount route modules
 *   6. Start listening
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';

// Importing db triggers table creation
import './db.js';

// Seed (no-ops if data already exists)
import { seed } from './seed.js';
seed();

// Route modules
import authRoutes from './routes/auth.js';
import playerRoutes from './routes/players.js';
import gameRoutes from './routes/games.js';
import groupRoutes from './routes/groups.js';
import scriptRoutes from './routes/scripts.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ──────────────────────────────────────────────────────────────────

// Parse JSON request bodies
app.use(express.json());

// CORS – in production, frontend is served from the same origin.
// In development, allow the Vite dev server origins.
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Same-origin in production; also allow any custom origins from env
  app.use(cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : true,
    credentials: true,
  }));
} else {
  app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  }));
}

// ─── Routes ─────────────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/scripts', scriptRoutes);

// Health-check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Serve frontend in production ───────────────────────────────────────────────

const clientDist = path.join(__dirname, '..', 'client', 'dist');

// Serve static assets from the Vite build output
app.use(express.static(clientDist));

// SPA fallback: any non-API route serves index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ─── 404 handler ────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// ─── Global error handler ───────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err.stack || err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error.'
      : err.message,
  });
});

// ─── Start ──────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🏰 Blood on the Clocktower API running on http://localhost:${PORT}`);
});

export default app;
