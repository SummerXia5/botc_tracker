/**
 * Reveal routes – ephemeral role-reveal sessions (v2).
 *
 * New flow:
 *   1. Storyteller creates session with characters assigned to seat numbers
 *      (no players yet) + list of available player names from the group.
 *   2. Players enter code, pick their name from the list, pick a seat.
 *   3. Once seated, they see their character.
 *
 * POST   /api/reveal            – Create a reveal session (storyteller).
 * GET    /api/reveal/:code      – Get session status (seats + available players).
 * POST   /api/reveal/:code/sit  – Player picks name + seat → see character.
 * DELETE /api/reveal/:code      – Delete a session (storyteller cleanup).
 */

import { Router } from 'express';

const router = Router();

// Map of code -> session data
const sessions = new Map();

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Generate a random 4-digit numeric code that isn't already in use.
 */
function generateCode() {
  let code;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (sessions.has(code));
  return code;
}

/**
 * Check if a session has expired (> 2 hours old). Deletes it if so.
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
  const { seats, scriptName, players } = req.body;

  if (!Array.isArray(seats) || seats.length === 0) {
    return res.status(400).json({ error: 'seats array is required and must not be empty.' });
  }

  if (!scriptName) {
    return res.status(400).json({ error: 'scriptName is required.' });
  }

  const code = generateCode();

  // seats: [{ characterId: 'washerwoman' }, ...]  (no player info)
  // players: [{ id: '...', name: 'Alice' }, ...]  (available player names from group)
  sessions.set(code, {
    scriptName,
    totalSeats: seats.length,
    // Store full character info for each seat index
    characters: seats.map(s => ({
      id: s.characterId,
      name: s.characterName || s.characterId,
      nameEn: s.characterNameEn || '',
      icon: s.characterIcon || '',
      ability: s.characterAbility || '',
      type: s.characterType || 'townsfolk',
    })),
    // Track who sat where: index -> { playerName, playerId }
    seated: new Array(seats.length).fill(null),
    // Track alive/dead and other status: index -> { alive: true }
    seatStatus: new Array(seats.length).fill(null).map(() => ({ alive: true })),
    // Available player names (from group)
    availablePlayers: Array.isArray(players) ? players.map(p => ({
      id: p.id,
      name: p.name,
      taken: false,
    })) : [],
    createdAt: Date.now(),
  });

  res.status(201).json({ code });
});

// ─── GET /api/reveal/:code ──────────────────────────────────────────────────────

router.get('/:code', (req, res) => {
  const session = getValidSession(req.params.code);
  if (!session) {
    return res.status(404).json({ error: '代码无效或已过期' });
  }

  // Return seat status (who's sitting where) + available players
  const seats = session.characters.map((charId, index) => ({
    seatIndex: index,
    seatNumber: index + 1,
    occupied: session.seated[index] !== null,
    playerName: session.seated[index]?.playerName || null,
    alive: session.seatStatus?.[index]?.alive ?? true,
    deathDay: session.seatStatus?.[index]?.deathDay || null,
    deathCause: session.seatStatus?.[index]?.deathCause || null,
  }));

  const availablePlayers = session.availablePlayers
    .filter(p => !p.taken)
    .map(p => ({ id: p.id, name: p.name }));

  const seatedCount = session.seated.filter(s => s !== null).length;

  res.json({
    scriptName: session.scriptName,
    totalSeats: session.totalSeats,
    seatedCount,
    allSeated: seatedCount === session.totalSeats,
    seats,
    availablePlayers,
  });
});

// ─── POST /api/reveal/:code/sit ─────────────────────────────────────────────────

router.post('/:code/sit', (req, res) => {
  const session = getValidSession(req.params.code);
  if (!session) {
    return res.status(404).json({ error: '代码无效或已过期' });
  }

  const { seatIndex, playerName, playerId } = req.body;

  // Validate seat index
  if (seatIndex == null || seatIndex < 0 || seatIndex >= session.totalSeats) {
    return res.status(400).json({ error: '无效的座位号' });
  }

  // Check seat not taken
  if (session.seated[seatIndex] !== null) {
    return res.status(409).json({ error: '该座位已被占用' });
  }

  // Validate player name
  if (!playerName || !playerName.trim()) {
    return res.status(400).json({ error: '请选择或输入玩家名' });
  }

  // If playerId provided, mark that player as taken
  if (playerId) {
    const player = session.availablePlayers.find(p => p.id === playerId);
    if (player) {
      if (player.taken) {
        return res.status(409).json({ error: '该玩家已入座' });
      }
      player.taken = true;
    }
  } else {
    // Check if name already used by another seated player
    const nameUsed = session.seated.some(s => s && s.playerName === playerName.trim());
    if (nameUsed) {
      return res.status(409).json({ error: '该玩家名已被使用' });
    }
  }

  // Seat the player — do NOT return character yet
  session.seated[seatIndex] = {
    playerName: playerName.trim(),
    playerId: playerId || null,
  };

  const allSeated = session.seated.every(s => s !== null);

  res.json({
    seated: true,
    playerName: playerName.trim(),
    seatIndex,
    seatNumber: seatIndex + 1,
    allSeated,
  });
});

// ─── GET /api/reveal/:code/mychar/:seatIndex ────────────────────────────────────
// Returns character for a seat. Only works when ALL players are seated.

router.get('/:code/mychar/:seatIndex', (req, res) => {
  const session = getValidSession(req.params.code);
  if (!session) {
    return res.status(404).json({ error: '代码无效或已过期' });
  }

  const seatIndex = parseInt(req.params.seatIndex, 10);
  if (isNaN(seatIndex) || seatIndex < 0 || seatIndex >= session.totalSeats) {
    return res.status(400).json({ error: '无效的座位号' });
  }

  // Only reveal when all seated
  const allSeated = session.seated.every(s => s !== null);
  if (!allSeated) {
    return res.status(403).json({ error: '等待所有玩家入座后才能查看角色' });
  }

  const character = session.characters[seatIndex];
  res.json({
    characterId: character.id,
    characterName: character.name,
    characterNameEn: character.nameEn,
    characterIcon: character.icon,
    characterAbility: character.ability,
    characterType: character.type,
    seatIndex,
    seatNumber: seatIndex + 1,
  });
});

// ─── POST /api/reveal/:code/unseat ──────────────────────────────────────────────
// Player stands up or storyteller removes a player from a seat.

router.post('/:code/unseat', (req, res) => {
  const session = getValidSession(req.params.code);
  if (!session) {
    return res.status(404).json({ error: '代码无效或已过期' });
  }

  const { seatIndex } = req.body;

  if (seatIndex == null || seatIndex < 0 || seatIndex >= session.totalSeats) {
    return res.status(400).json({ error: '无效的座位号' });
  }

  const seatData = session.seated[seatIndex];
  if (!seatData) {
    return res.status(400).json({ error: '该座位没有人' });
  }

  // Restore player to available list if they were from the group
  if (seatData.playerId) {
    const player = session.availablePlayers.find(p => p.id === seatData.playerId);
    if (player) {
      player.taken = false;
    }
  }

  // Clear the seat
  session.seated[seatIndex] = null;

  res.json({ message: '已起立', seatIndex, seatNumber: seatIndex + 1 });
});

// ─── POST /api/reveal/:code/sync ────────────────────────────────────────────────
// Storyteller synchronizes seat names and alive/dead status from Grimoire.
router.post('/:code/sync', (req, res) => {
  const session = getValidSession(req.params.code);
  if (!session) {
    return res.status(404).json({ error: '代码无效或已过期' });
  }

  const { seats } = req.body;
  if (!Array.isArray(seats)) {
    return res.status(400).json({ error: 'seats array required' });
  }

  if (!session.seatStatus) {
    session.seatStatus = new Array(session.totalSeats).fill(null).map(() => ({ alive: true }));
  }

  for (const s of seats) {
    if (s.seatIndex == null || s.seatIndex < 0 || s.seatIndex >= session.totalSeats) continue;
    const isRealName = s.playerName && !s.playerName.startsWith('座位') && !s.playerName.startsWith('Player');
    if (session.seated[s.seatIndex]) {
      if (isRealName) session.seated[s.seatIndex].playerName = s.playerName;
    } else if (isRealName) {
      session.seated[s.seatIndex] = { playerName: s.playerName, playerId: s.playerId || null };
    }
    session.seatStatus[s.seatIndex] = {
      ...(session.seatStatus[s.seatIndex] || {}),
      alive: s.alive !== undefined ? !!s.alive : true,
      deathDay: s.deathDay != null ? s.deathDay : null,
      deathCause: s.deathCause || null,
    };
  }

  res.json({ message: 'synchronized successfully' });
});

export default router;
