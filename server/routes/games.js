/**
 * Game routes – list, detail, and create game sessions.
 *
 * GET  /api/games       – Public, paginated list with participants.
 * GET  /api/games/:id   – Public, single game with full participant details.
 * POST /api/games       – Protected, create a game + participants in one transaction.
 */

import { Router } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();

// ─── GET /api/games ─────────────────────────────────────────────────────────────

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('group_id').optional().trim(),
  ],
  (req, res) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const offset = (page - 1) * limit;
    const { group_id } = req.query;

    // Total count for pagination metadata
    let total, games;
    if (group_id) {
      total = db.prepare('SELECT COUNT(*) AS count FROM games WHERE group_id = ?').get(group_id).count;
      games = db.prepare(
        'SELECT * FROM games WHERE group_id = ? ORDER BY date DESC LIMIT ? OFFSET ?',
      ).all(group_id, limit, offset);
    } else {
      total = db.prepare('SELECT COUNT(*) AS count FROM games').get().count;
      games = db.prepare(
        'SELECT * FROM games ORDER BY date DESC LIMIT ? OFFSET ?',
      ).all(limit, offset);
    }

    // Attach participants to each game
    const participantStmt = db.prepare(`
      SELECT
        gp.player_id,
        gp.role_type,
        gp.survived,
        gp.final_round,
        gp.correct_vote,
        gp.achievements,
        gp.survival_days,
        gp.player_notes,
        p.name   AS player_name,
        p.avatar AS player_avatar
      FROM game_participants gp
      JOIN players p ON p.id = gp.player_id
      WHERE gp.game_id = ?
    `);

    const gamesWithParticipants = games.map((game) => ({
      ...game,
      participants: participantStmt.all(game.id),
    }));

    res.json({
      games: gamesWithParticipants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },
);

// ─── GET /api/games/:id ─────────────────────────────────────────────────────────

router.get(
  '/:id',
  param('id').trim().notEmpty(),
  (req, res) => {
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);

    if (!game) {
      return res.status(404).json({ error: 'Game not found.' });
    }

    // Full participant details including player info
    const participants = db.prepare(`
      SELECT
        gp.id            AS participant_id,
        gp.player_id,
        gp.role_type,
        gp.survived,
        gp.final_round,
        gp.correct_vote,
        gp.achievements,
        gp.survival_days,
        gp.player_notes,
        p.name           AS player_name,
        p.avatar         AS player_avatar,
        p.desc           AS player_desc
      FROM game_participants gp
      JOIN players p ON p.id = gp.player_id
      WHERE gp.game_id = ?
    `).all(game.id);

    // Resolve MVP player name
    let mvp = null;
    if (game.mvp_player_id) {
      mvp = db.prepare('SELECT id, name, avatar FROM players WHERE id = ?').get(game.mvp_player_id);
    }

    res.json({ game: { ...game, participants, mvp } });
  },
);

// ─── POST /api/games ────────────────────────────────────────────────────────────

router.post(
  '/',
  authenticateJWT,
  [
    body('date').isISO8601().withMessage('Date must be a valid ISO date (YYYY-MM-DD).'),
    body('script').trim().notEmpty().withMessage('Script name is required.'),
    body('winner').isIn(['good', 'evil']).withMessage('Winner must be "good" or "evil".'),
    body('storyline').optional({ nullable: true }).trim(),
    body('mvp_player_id').optional({ nullable: true }).trim(),
    body('notes').optional({ nullable: true }).trim(),
    body('group_id').trim().notEmpty().withMessage('group_id is required.'),
    body('participants')
      .isArray({ min: 5 })
      .withMessage('At least 5 participants are required.'),
    body('participants.*.player_id').trim().notEmpty().withMessage('Each participant needs a player_id.'),
    body('participants.*.role_type')
      .isIn(['townsfolk', 'outsider', 'minion', 'demon'])
      .withMessage('role_type must be townsfolk, outsider, minion, or demon.'),
    body('participants.*.survived').optional().toBoolean(),
    body('participants.*.final_round').optional().toBoolean(),
    body('participants.*.correct_vote').optional().toBoolean(),
    body('participants.*.achievements').optional(),
    body('participants.*.survival_days').optional().isInt({ min: 0 }),
    body('participants.*.player_notes').optional().trim(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { date, script, winner, storyline, mvp_player_id, notes, participants, group_id } = req.body;

    // Validate that the group exists
    const groupExists = db.prepare('SELECT id FROM groups WHERE id = ?').get(group_id);
    if (!groupExists) {
      return res.status(400).json({ error: `Group "${group_id}" does not exist.` });
    }

    // Validate that all referenced player_ids actually exist
    const checkPlayer = db.prepare('SELECT id FROM players WHERE id = ?');
    const missingPlayers = participants
      .map((p) => p.player_id)
      .filter((pid) => !checkPlayer.get(pid));

    if (missingPlayers.length > 0) {
      return res.status(400).json({
        error: `Unknown player_id(s): ${missingPlayers.join(', ')}`,
      });
    }

    const gameId = `game-${uuidv4().slice(0, 8)}`;

    // Use a transaction so the game + all participants either all succeed or all roll back
    const createGame = db.transaction(() => {
      db.prepare(`
        INSERT INTO games (id, date, script, winner, storyline, mvp_player_id, notes, created_by, group_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(gameId, date, script, winner, storyline || null, mvp_player_id || null, notes || null, req.user.userId, group_id);

      const insertPart = db.prepare(`
        INSERT INTO game_participants (game_id, player_id, role_type, survived, final_round, correct_vote, achievements, survival_days, player_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const p of participants) {
        insertPart.run(
          gameId,
          p.player_id,
          p.role_type,
          p.survived ? 1 : 0,
          p.final_round ? 1 : 0,
          p.correct_vote ? 1 : 0,
          JSON.stringify(p.achievements || []),
          p.survival_days ?? null,
          p.player_notes || null,
        );
      }
    });

    createGame();

    // Return the created game
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    const gameParts = db.prepare(`
      SELECT gp.*, p.name AS player_name, p.avatar AS player_avatar
      FROM game_participants gp
      JOIN players p ON p.id = gp.player_id
      WHERE gp.game_id = ?
    `).all(gameId);

    res.status(201).json({ game: { ...game, participants: gameParts } });
  },
);

export default router;
