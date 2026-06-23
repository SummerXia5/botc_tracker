/**
 * Player routes – full CRUD + claim/unclaim.
 *
 * GET    /api/players            – Public, returns all players.
 * POST   /api/players            – Protected, creates a new player.
 * PUT    /api/players/:id        – Protected, updates a player.
 * DELETE /api/players/:id        – Protected, deletes a player.
 * POST   /api/players/:id/claim  – Protected, claim a player profile.
 * DELETE /api/players/:id/unclaim – Protected, unclaim a player profile.
 */

import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import db from '../db.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();

// ─── GET /api/players ───────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const { group_id } = req.query;

  if (group_id) {
    const players = db.prepare('SELECT id, name, avatar, desc, is_system, created_at, group_id, user_id FROM players WHERE group_id = ? ORDER BY created_at ASC').all(group_id);
    return res.json({ players });
  }

  const players = db.prepare('SELECT id, name, avatar, desc, is_system, created_at, group_id, user_id FROM players ORDER BY created_at ASC').all();
  res.json({ players });
});

// ─── POST /api/players ──────────────────────────────────────────────────────────

router.post(
  '/',
  authenticateJWT,
  [
    body('name').trim().notEmpty().withMessage('Player name is required.'),
    body('avatar').optional().trim(),
    body('desc').optional().trim(),
    body('id').optional().trim(),
    body('group_id').trim().notEmpty().withMessage('group_id is required.'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, avatar, desc, group_id } = req.body;

    // Validate that the group exists
    const groupExists = db.prepare('SELECT id FROM groups WHERE id = ?').get(group_id);
    if (!groupExists) {
      return res.status(400).json({ error: `Group "${group_id}" does not exist.` });
    }

    // Generate a URL-safe id from the name if not explicitly provided
    let id = req.body.id;
    if (!id) {
      id = name
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-') // keep Chinese chars, replace rest
        .replace(/^-|-$/g, '');
      // Append random suffix to avoid collisions
      id += '-' + Math.random().toString(36).slice(2, 6);
    }

    // Check for duplicate id
    const existing = db.prepare('SELECT id FROM players WHERE id = ?').get(id);
    if (existing) {
      return res.status(409).json({ error: `Player with id "${id}" already exists.` });
    }

    const stmt = db.prepare(
      'INSERT INTO players (id, name, avatar, desc, is_system, group_id) VALUES (?, ?, ?, ?, 0, ?)',
    );
    stmt.run(id, name, avatar || null, desc || null, group_id);

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    res.status(201).json({ player });
  },
);

// ─── PUT /api/players/:id ───────────────────────────────────────────────────────

router.put(
  '/:id',
  authenticateJWT,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty.'),
    body('avatar').optional().trim(),
    body('desc').optional().trim(),
    body('group_id').optional().trim(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Player not found.' });
    }

    const name = req.body.name !== undefined ? req.body.name : existing.name;
    const avatar = req.body.avatar !== undefined ? req.body.avatar : existing.avatar;
    const desc = req.body.desc !== undefined ? req.body.desc : existing.desc;
    const group_id = req.body.group_id !== undefined ? req.body.group_id : existing.group_id;

    // Validate group_id if being changed
    if (req.body.group_id !== undefined && group_id) {
      const groupExists = db.prepare('SELECT id FROM groups WHERE id = ?').get(group_id);
      if (!groupExists) {
        return res.status(400).json({ error: `Group "${group_id}" does not exist.` });
      }
    }

    db.prepare('UPDATE players SET name = ?, avatar = ?, desc = ?, group_id = ? WHERE id = ?')
      .run(name, avatar || null, desc || null, group_id || null, id);

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    res.json({ player });
  },
);

// ─── DELETE /api/players/:id ────────────────────────────────────────────────────

router.delete('/:id', authenticateJWT, (req, res) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Player not found.' });
  }

  // Check if player has participated in any games
  const gameCount = db.prepare(
    'SELECT COUNT(*) AS count FROM game_participants WHERE player_id = ?',
  ).get(id);

  if (gameCount.count > 0) {
    return res.status(409).json({
      error: `无法删除：该玩家已参与 ${gameCount.count} 场比赛。`,
    });
  }

  db.prepare('DELETE FROM players WHERE id = ?').run(id);
  res.json({ message: 'Player deleted.', id });
});

// ─── POST /api/players/:id/claim ────────────────────────────────────────────────

router.post('/:id/claim', authenticateJWT, (req, res) => {
  const { id } = req.params;
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
  if (!player) return res.status(404).json({ error: 'Player not found' });

  // Check if already claimed by someone else
  if (player.user_id && player.user_id !== req.user.userId) {
    return res.status(409).json({ error: '该档案已被其他用户认领' });
  }

  // Check if user already claimed a different player in this group
  const existing = db.prepare('SELECT * FROM players WHERE user_id = ? AND group_id = ? AND id != ?').get(req.user.userId, player.group_id, id);
  if (existing) {
    return res.status(409).json({ error: `你在该组已认领了 "${existing.name}"，请先解除` });
  }

  db.prepare('UPDATE players SET user_id = ? WHERE id = ?').run(req.user.userId, id);
  // Also update group_members to link player_id
  db.prepare('UPDATE group_members SET player_id = ? WHERE user_id = ? AND group_id = ?').run(id, req.user.userId, player.group_id);

  const updated = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
  res.json({ player: updated });
});

// ─── DELETE /api/players/:id/unclaim ────────────────────────────────────────────

router.delete('/:id/unclaim', authenticateJWT, (req, res) => {
  const { id } = req.params;
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  if (player.user_id !== req.user.userId) {
    return res.status(403).json({ error: '只能解除自己认领的档案' });
  }

  db.prepare('UPDATE players SET user_id = NULL WHERE id = ?').run(id);
  db.prepare('UPDATE group_members SET player_id = NULL WHERE user_id = ? AND group_id = ?').run(req.user.userId, player.group_id);
  res.json({ message: '已解除认领' });
});

export default router;
