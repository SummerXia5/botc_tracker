/**
 * Authentication routes – register, login, and current-user lookup.
 *
 * Registration is intentionally limited: only the very first user can
 * register (single-admin model). After that, login is the only path.
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

router.post('/register', usernameRules, passwordRules, (req, res) => {
  const invalid = handleValidationErrors(req, res);
  if (invalid) return;

  // Only allow registration when no users exist (first user = admin)
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (userCount.count > 0) {
    return res.status(403).json({ error: 'Registration closed. An admin already exists.' });
  }

  const { username, password } = req.body;

  // Hash the password (10 salt rounds)
  const passwordHash = bcrypt.hashSync(password, 10);

  const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
  const result = stmt.run(username, passwordHash);

  const token = jwt.sign(
    { userId: result.lastInsertRowid, username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );

  res.status(201).json({
    message: 'Admin account created.',
    token,
    user: { id: result.lastInsertRowid, username },
  });
});

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
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );

  res.json({
    message: 'Login successful.',
    token,
    user: { id: user.id, username: user.username },
  });
});

// ─── GET /api/auth/me ───────────────────────────────────────────────────────────

router.get('/me', authenticateJWT, (req, res) => {
  const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json({ user });
});

export default router;
