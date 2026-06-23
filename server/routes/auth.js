/**
 * Authentication routes – register, login, and current-user lookup.
 *
 * Supports multi-user registration with roles: storyteller and player.
 */

import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const JWT_EXPIRY = '7d';

// ─── Validation helpers ─────────────────────────────────────────────────────────

const usernameRules = body('username')
  .trim()
  .isLength({ min: 3, max: 20 })
  .withMessage('Username must be 3-20 characters.');

const passwordRules = body('password')
  .isLength({ min: 6 })
  .withMessage('Password must be at least 6 characters.');

/**
 * Return early with 400 if express-validator found issues.
 */
function handleValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
}

// ─── POST /api/auth/register ────────────────────────────────────────────────────

router.post(
  '/register',
  usernameRules,
  passwordRules,
  body('role').optional().isIn(['storyteller', 'player']).withMessage('Role must be storyteller or player.'),
  body('display_name').optional().trim(),
  (req, res) => {
    const invalid = handleValidationErrors(req, res);
    if (invalid) return;

    const { username, password } = req.body;
    const role = req.body.role || 'player';
    const display_name = req.body.display_name || null;

    // Check for duplicate username
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken.' });
    }

    // Hash the password (10 salt rounds)
    const passwordHash = bcrypt.hashSync(password, 10);

    const stmt = db.prepare('INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)');
    const result = stmt.run(username, passwordHash, role, display_name);

    const token = jwt.sign(
      { userId: result.lastInsertRowid, username, role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY },
    );

    res.status(201).json({
      message: 'Account created.',
      token,
      user: { id: result.lastInsertRowid, username, role, display_name },
    });
  },
);

// ─── POST /api/auth/login ───────────────────────────────────────────────────────

router.post('/login', usernameRules, passwordRules, (req, res) => {
  const invalid = handleValidationErrors(req, res);
  if (invalid) return;

  const { username, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );

  res.json({
    message: 'Login successful.',
    token,
    user: { id: user.id, username: user.username, role: user.role, display_name: user.display_name, avatar: user.avatar },
  });
});

// ─── GET /api/auth/me ───────────────────────────────────────────────────────────

router.get('/me', authenticateJWT, (req, res) => {
  const user = db.prepare('SELECT id, username, role, display_name, avatar, created_at FROM users WHERE id = ?').get(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json({ user });
});

// ─── PUT /api/auth/profile ──────────────────────────────────────────────────────────────────

router.put('/profile', authenticateJWT, (req, res) => {
  const { display_name, avatar } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const newDisplayName = display_name !== undefined ? display_name : user.display_name;
  const newAvatar = avatar !== undefined ? avatar : user.avatar;

  db.prepare('UPDATE users SET display_name = ?, avatar = ? WHERE id = ?')
    .run(newDisplayName, newAvatar, req.user.userId);

  const updated = db.prepare('SELECT id, username, role, display_name, avatar, created_at FROM users WHERE id = ?')
    .get(req.user.userId);
  res.json({ user: updated });
});

// ─── GET /api/auth/profile ──────────────────────────────────────────────────────

router.get('/profile', authenticateJWT, (req, res) => {
  const user = db.prepare('SELECT id, username, display_name, avatar, role, created_at FROM users WHERE id = ?').get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Get all groups user is a member of
  const memberships = db.prepare(`
    SELECT gm.group_id, gm.player_id, gm.joined_at,
           g.name as group_name, g.avatar as group_avatar, g.description as group_description,
           g.created_by
    FROM group_members gm
    JOIN groups g ON gm.group_id = g.id
    WHERE gm.user_id = ?
    ORDER BY gm.joined_at ASC
  `).all(user.id);

  // Get all claimed player profiles with their stats
  const claimedPlayers = db.prepare(`
    SELECT p.* FROM players p WHERE p.user_id = ?
  `).all(user.id);

  // Get all games for claimed players
  const playerIds = claimedPlayers.map(p => p.id);
  let allGames = [];
  if (playerIds.length > 0) {
    const placeholders = playerIds.map(() => '?').join(',');
    const gameIds = db.prepare(`
      SELECT DISTINCT game_id FROM game_participants WHERE player_id IN (${placeholders})
    `).all(...playerIds).map(r => r.game_id);

    if (gameIds.length > 0) {
      const gamePlaceholders = gameIds.map(() => '?').join(',');
      allGames = db.prepare(`SELECT * FROM games WHERE id IN (${gamePlaceholders}) ORDER BY date DESC`).all(...gameIds);
      // Attach participants to each game
      const pStmt = db.prepare('SELECT * FROM game_participants WHERE game_id = ?');
      for (const game of allGames) {
        game.participants = pStmt.all(game.id);
      }
    }
  }

  res.json({ user, memberships, claimedPlayers, games: allGames });
});

export default router;
