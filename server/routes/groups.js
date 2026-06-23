/**
 * Group routes – full CRUD for player groups.
 *
 * GET    /api/groups           – Public, returns all groups.
 * POST   /api/groups           – Protected (storyteller only), creates a new group.
 * GET    /api/groups/:id       – Public, get a single group.
 * PUT    /api/groups/:id       – Protected (owner only), updates a group.
 * DELETE /api/groups/:id       – Protected (owner only), deletes a group (only if no games).
 * POST   /api/groups/:id/join  – Protected, join a group.
 * DELETE /api/groups/:id/leave – Protected, leave a group.
 * GET    /api/groups/:id/members – Public, list group members.
 */

import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import db from '../db.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();

// ─── GET /api/groups ────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const groups = db.prepare('SELECT * FROM groups ORDER BY created_at ASC').all();
  res.json({ groups });
});

// ─── POST /api/groups ───────────────────────────────────────────────────────────

router.post(
  '/',
  authenticateJWT,
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Group name is required.')
      .isLength({ min: 1, max: 30 }).withMessage('Group name must be 1-30 characters.'),
    body('description').optional().trim(),
    body('avatar').optional().trim(),
    body('id').optional().trim(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Only storytellers can create groups
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.userId);
    if (!user || user.role !== 'storyteller') {
      return res.status(403).json({ error: '只有说书人才能创建分组' });
    }

    const { name, description, avatar } = req.body;

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
    const existing = db.prepare('SELECT id FROM groups WHERE id = ?').get(id);
    if (existing) {
      return res.status(409).json({ error: `Group with id "${id}" already exists.` });
    }

    db.prepare(
      'INSERT INTO groups (id, name, description, avatar, created_by) VALUES (?, ?, ?, ?, ?)',
    ).run(id, name, description || null, avatar || null, req.user.userId);

    // Auto-add creator as group member
    db.prepare('INSERT INTO group_members (user_id, group_id) VALUES (?, ?)').run(req.user.userId, id);

    // Seed official scripts for the new group
    const OFFICIAL_SCRIPTS = [
      {
        name: '初来乍到 (Trouble Brewing)',
        characters: ['washerwoman','librarian','investigator','chef','empath','fortune_teller','undertaker','monk','ravenkeeper','virgin','slayer','soldier','mayor','butler','drunk','recluse','saint','poisoner','spy','scarlet_woman','baron','imp'],
      },
      {
        name: '暗流涌动 (Bad Moon Rising)',
        characters: ['grandmother','sailor','chambermaid','exorcist','innkeeper','gambler','gossip','courtier','professor','minstrel','tea_lady','pacifist','fool','tinker','moonchild','goon','lunatic','godfather','devils_advocate','assassin','mastermind','zombuul','pukka','shabaloth','po'],
      },
      {
        name: '梦中杀机 (Sects & Violets)',
        characters: ['clockmaker','dreamer','snake_charmer','mathematician','flowergirl','town_crier','oracle','savant','seamstress','philosopher','artist','juggler','sage','mutant','sweetheart','barber','klutz','evil_twin','witch','cerenovus','pit_hag','fang_gu','vigormortis','no_dashii','vortox'],
      },
    ];
    const insertScript = db.prepare(
      'INSERT OR IGNORE INTO scripts (id, name, group_id, characters, is_official) VALUES (?, ?, ?, ?, 1)',
    );
    for (const s of OFFICIAL_SCRIPTS) {
      const sid = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + id;
      insertScript.run(sid, s.name, id, JSON.stringify(s.characters));
    }

    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
    res.status(201).json({ group });
  },
);

// ─── GET /api/groups/:id ────────────────────────────────────────────────────────

router.get('/:id', (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);

  if (!group) {
    return res.status(404).json({ error: 'Group not found.' });
  }

  res.json({ group });
});

// ─── PUT /api/groups/:id ────────────────────────────────────────────────────────

router.put(
  '/:id',
  authenticateJWT,
  [
    body('name')
      .optional()
      .trim()
      .notEmpty().withMessage('Name cannot be empty.')
      .isLength({ min: 1, max: 30 }).withMessage('Group name must be 1-30 characters.'),
    body('description').optional().trim(),
    body('avatar').optional().trim(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    // Only the group creator can update
    if (existing.created_by !== req.user.userId) {
      return res.status(403).json({ error: '只有组的创建者才能执行此操作' });
    }

    const name = req.body.name !== undefined ? req.body.name : existing.name;
    const description = req.body.description !== undefined ? req.body.description : existing.description;
    const avatar = req.body.avatar !== undefined ? req.body.avatar : existing.avatar;

    db.prepare('UPDATE groups SET name = ?, description = ?, avatar = ? WHERE id = ?')
      .run(name, description || null, avatar || null, id);

    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
    res.json({ group });
  },
);

// ─── DELETE /api/groups/:id ─────────────────────────────────────────────────────

router.delete('/:id', authenticateJWT, (req, res) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Group not found.' });
  }

  // Only the group creator can delete
  if (existing.created_by !== req.user.userId) {
    return res.status(403).json({ error: '只有组的创建者才能执行此操作' });
  }

  // Check if group has any games
  const gameCount = db.prepare(
    'SELECT COUNT(*) AS count FROM games WHERE group_id = ?',
  ).get(id);

  if (gameCount.count > 0) {
    return res.status(409).json({
      error: `无法删除：该分组下还有 ${gameCount.count} 场比赛。`,
    });
  }

  // Remove group_id references from players before deleting
  db.prepare('UPDATE players SET group_id = NULL WHERE group_id = ?').run(id);
  db.prepare('DELETE FROM groups WHERE id = ?').run(id);
  res.json({ message: 'Group deleted.', id });
});

// ─── POST /api/groups/:id/join ──────────────────────────────────────────────────

router.post('/:id/join', authenticateJWT, (req, res) => {
  const groupId = req.params.id;
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const existing = db.prepare('SELECT * FROM group_members WHERE user_id = ? AND group_id = ?').get(req.user.userId, groupId);
  if (existing) return res.status(409).json({ error: '已经加入了该组' });

  db.prepare('INSERT INTO group_members (user_id, group_id) VALUES (?, ?)').run(req.user.userId, groupId);
  res.json({ message: '成功加入' });
});

// ─── DELETE /api/groups/:id/leave ───────────────────────────────────────────────

router.delete('/:id/leave', authenticateJWT, (req, res) => {
  db.prepare('DELETE FROM group_members WHERE user_id = ? AND group_id = ?').run(req.user.userId, req.params.id);
  // Also unclaim any player
  db.prepare('UPDATE players SET user_id = NULL WHERE user_id = ? AND group_id = ?').run(req.user.userId, req.params.id);
  res.json({ message: '已离开' });
});

// ─── GET /api/groups/:id/members ────────────────────────────────────────────────

router.get('/:id/members', (req, res) => {
  const members = db.prepare(`
    SELECT gm.*, u.username, u.display_name, u.avatar as user_avatar, u.role as user_role,
           p.name as player_name, p.id as claimed_player_id
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    LEFT JOIN players p ON p.user_id = u.id AND p.group_id = gm.group_id
    WHERE gm.group_id = ?
    ORDER BY gm.joined_at ASC
  `).all(req.params.id);
  res.json({ members });
});

export default router;
