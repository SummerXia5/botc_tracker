/**
 * Script routes – CRUD for game scripts.
 *
 * GET    /api/scripts?group_id=xxx  – Public, returns scripts for a group.
 * POST   /api/scripts               – Protected, creates/imports a script.
 * DELETE /api/scripts/:id            – Protected, deletes a script.
 */

import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import db from '../db.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();

// ─── GET /api/scripts ───────────────────────────────────────────────────────────

router.get(
  '/',
  [
    query('group_id').trim().notEmpty().withMessage('group_id query parameter is required.'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { group_id } = req.query;

    const scripts = db
      .prepare('SELECT * FROM scripts WHERE group_id = ? ORDER BY created_at ASC')
      .all(group_id);

    // Parse the characters JSON string back to an array for each script
    const parsed = scripts.map((s) => ({
      ...s,
      characters: s.characters ? JSON.parse(s.characters) : [],
    }));

    res.json({ scripts: parsed });
  },
);

// ─── POST /api/scripts ──────────────────────────────────────────────────────────

router.post(
  '/',
  authenticateJWT,
  [
    body('name').trim().notEmpty().withMessage('Script name is required.'),
    body('group_id').trim().notEmpty().withMessage('group_id is required.'),
    body('characters').isArray().withMessage('characters must be an array.'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, group_id, characters } = req.body;

    // Validate that the group exists
    const groupExists = db.prepare('SELECT id FROM groups WHERE id = ?').get(group_id);
    if (!groupExists) {
      return res.status(400).json({ error: `Group "${group_id}" does not exist.` });
    }

    // Generate a URL-safe id from the name
    let id = name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
      .replace(/^-|-$/g, '');
    // Append random suffix to avoid collisions
    id += '-' + Math.random().toString(36).slice(2, 6);

    // Check for duplicate id
    const existing = db.prepare('SELECT id FROM scripts WHERE id = ?').get(id);
    if (existing) {
      return res.status(409).json({ error: `Script with id "${id}" already exists.` });
    }

    const charactersJson = JSON.stringify(characters);

    db.prepare(
      'INSERT INTO scripts (id, name, group_id, characters, is_official) VALUES (?, ?, ?, ?, 0)',
    ).run(id, name, group_id, charactersJson);

    const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(id);
    res.status(201).json({
      script: {
        ...script,
        characters: script.characters ? JSON.parse(script.characters) : [],
      },
    });
  },
);

// ─── DELETE /api/scripts/:id ────────────────────────────────────────────────────

router.delete('/:id', authenticateJWT, (req, res) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM scripts WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Script not found.' });
  }

  // Don't allow deleting official scripts
  if (existing.is_official === 1) {
    return res.status(403).json({ error: '无法删除官方剧本。' });
  }

  // Check if any games reference this script name
  const gameCount = db.prepare(
    'SELECT COUNT(*) AS count FROM games WHERE script = ?',
  ).get(existing.name);

  if (gameCount.count > 0) {
    return res.status(409).json({
      error: `无法删除：该剧本已被 ${gameCount.count} 场比赛引用。`,
    });
  }

  db.prepare('DELETE FROM scripts WHERE id = ?').run(id);
  res.json({ message: 'Script deleted.', id });
});

export default router;
