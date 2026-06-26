/**
 * Reveal routes – ephemeral role-reveal sessions.
 *
 * POST   /api/reveal            – Create a reveal session (storyteller).
 * GET    /api/reveal/:code      – Get session info (players).
 * POST   /api/reveal/:code/claim – Claim a seat to see your character.
 * DELETE /api/reveal/:code      – Delete a session (storyteller cleanup).
 */

import { Router } from 'express';

const router = Router();

// Map of code -> session data
const sessions = new Map();

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Generate a random 6-digit numeric code that isn't already in use.
 */
function generateCode() {
  let code;
  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (sessions.has(code));
  return code;
}

/**
 * Check if a session has expired (> 2 hours old). Deletes it if so.
 * Returns the session if still valid, or null.
 */
function getValidSession(code) {
  const session = sessions.get(code);
  if (!session) return null;

  if (Date.now() - session.createdAt > TWO_HOURS_MS) {
    sessions.delete(code);
    return null;
  }

  return session;
}

// ─── POST /api/reveal ───────────────────────────────────────────────────────────

router.post('/', (req, res) => {
  const { seats, scriptName } = req.body;

  if (!Array.isArray(seats) || seats.length === 0) {
    return res.status(400).json({ error: 'seats array is required and must not be empty.' });
  }

  if (!scriptName) {
    return res.status(400).json({ error: 'scriptName is required.' });
  }

  const code = generateCode();

  sessions.set(code, {
    scriptName,
    seats,
    claimed: new Array(seats.length).fill(false),
    createdAt: Date.now(),
  });

  res.status(201).json({ code });
});

// ─── GET /api/reveal/:code ──────────────────────────────────────────────────────

router.get('/:code', (req, res) => {
  const session = getValidSession(req.params.code);
  if (!session) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  const players = session.seats.map((seat, index) => ({
    seatIndex: index,
    name: seat.player?.name ?? null,
    claimed: session.claimed[index],
  }));

  res.json({ scriptName: session.scriptName, players });
});

// ─── POST /api/reveal/:code/claim ───────────────────────────────────────────────

router.post('/:code/claim', (req, res) => {
  const session = getValidSession(req.params.code);
  if (!session) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  const { seatIndex } = req.body;

  if (seatIndex == null || seatIndex < 0 || seatIndex >= session.seats.length) {
    return res.status(400).json({ error: 'Invalid seatIndex.' });
  }

  if (session.claimed[seatIndex]) {
    return res.status(409).json({ error: 'This seat has already been claimed.' });
  }

  session.claimed[seatIndex] = true;
  const seat = session.seats[seatIndex];

  res.json({
    characterId: seat.characterId,
    playerName: seat.player?.name ?? null,
    seatIndex,
  });
});

// ─── DELETE /api/reveal/:code ───────────────────────────────────────────────────

router.delete('/:code', (req, res) => {
  const existed = sessions.delete(req.params.code);
  if (!existed) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  res.json({ message: 'Session deleted.' });
});

export default router;
