/**
 * Database initialization module.
 *
 * Uses better-sqlite3 for synchronous, high-performance SQLite access.
 * Creates all required tables on first import if they don't already exist.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'botc.db');

// Ensure the directory exists (critical for cloud deployments with persistent disks)
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Open (or create) the database file
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Enable foreign key enforcement (off by default in SQLite)
db.pragma('foreign_keys = ON');

/**
 * Initialize all tables. Each CREATE TABLE uses IF NOT EXISTS
 * so this is safe to call multiple times.
 */
function initDatabase() {
  db.exec(`
    -- Admin / operator accounts
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT    UNIQUE NOT NULL,
      password_hash TEXT  NOT NULL,
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    -- Player groups
    CREATE TABLE IF NOT EXISTS groups (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      avatar      TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- Players who participate in games
    CREATE TABLE IF NOT EXISTS players (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      avatar      TEXT,
      desc        TEXT,
      is_system   INTEGER DEFAULT 0,
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    -- Individual game sessions
    CREATE TABLE IF NOT EXISTS games (
      id          TEXT PRIMARY KEY,
      date        TEXT NOT NULL,
      script      TEXT NOT NULL,
      winner      TEXT NOT NULL CHECK(winner IN ('good', 'evil')),
      storyline   TEXT,
      mvp_player_id TEXT,
      notes       TEXT,
      created_by  INTEGER REFERENCES users(id),
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    -- Many-to-many: which players participated in which game
    CREATE TABLE IF NOT EXISTS game_participants (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id       TEXT    NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      player_id     TEXT    NOT NULL REFERENCES players(id),
      role_type     TEXT    NOT NULL CHECK(role_type IN ('townsfolk', 'outsider', 'minion', 'demon')),
      survived      INTEGER DEFAULT 0,
      final_round   INTEGER DEFAULT 0,
      correct_vote  INTEGER DEFAULT 0
    );

    -- Speed up common queries
    CREATE INDEX IF NOT EXISTS idx_game_participants_game
      ON game_participants(game_id);
    CREATE INDEX IF NOT EXISTS idx_game_participants_player
      ON game_participants(player_id);
    CREATE INDEX IF NOT EXISTS idx_games_date
      ON games(date);

    -- Scripts per group
    CREATE TABLE IF NOT EXISTS scripts (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      group_id    TEXT NOT NULL REFERENCES groups(id),
      characters  TEXT,
      is_official INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_scripts_group ON scripts(group_id);
  `);

  // Add group_id to players and games if not exists
  // SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN, so wrap in try/catch
  try { db.exec('ALTER TABLE players ADD COLUMN group_id TEXT REFERENCES groups(id)'); } catch (e) { /* column already exists */ }
  try { db.exec('ALTER TABLE games ADD COLUMN group_id TEXT REFERENCES groups(id)'); } catch (e) { /* column already exists */ }

  // New participant detail columns (safe migration)
  try { db.exec('ALTER TABLE game_participants ADD COLUMN achievements TEXT DEFAULT \'[]\''); } catch (e) { /* column already exists */ }
  try { db.exec('ALTER TABLE game_participants ADD COLUMN survival_days INTEGER'); } catch (e) { /* column already exists */ }
  try { db.exec('ALTER TABLE game_participants ADD COLUMN player_notes TEXT'); } catch (e) { /* column already exists */ }

  // Indexes on group_id (must come after ALTER TABLE adds the columns)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_players_group ON players(group_id);
    CREATE INDEX IF NOT EXISTS idx_games_group ON games(group_id);
  `);
}

// Run table creation on module load
initDatabase();

export default db;
