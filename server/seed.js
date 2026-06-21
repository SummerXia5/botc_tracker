/**
 * Seed script – populates the database with 12 initial players and 45 mock games.
 *
 * Design decisions:
 *   - Uses a deterministic Mulberry32 PRNG (seed 42) so data is reproducible.
 *   - Ash and Kangbo are weighted to appear in ~90% of games and enjoy higher
 *     win rates to match their lore descriptions.
 *   - Idempotent: skips seeding if players already exist.
 */

import db from './db.js';
import { v4 as uuidv4 } from 'uuid';

// ─── 12 Initial Players ────────────────────────────────────────────────────────

const INITIAL_PLAYERS = [
  { id: 'ash',      name: 'Ash (阿什)',        avatar: '🔮', desc: '全能战力天花板，极其恐怖的局势掌控力，好坏阵营皆是领袖' },
  { id: 'kangbo',   name: 'Kangbo (康博)',      avatar: '⚡', desc: '高五星战力/稳定带队，逻辑与演技的完美平衡' },
  { id: 'yuki',     name: 'Yuki (有希)',        avatar: '🌙', desc: '低调藏身份/外来者王者，沉稳的局势观察者' },
  { id: 'summer',   name: 'Summer (夏末)',      avatar: '☀️', desc: '信息整合/好人雷达，敏锐的阵营判断力' },
  { id: 'liang',    name: 'Liang (亮亮)',       avatar: '🎯', desc: '精准打击/冷静分析，关键时刻从不手软' },
  { id: 'nana',     name: 'Nana (娜娜)',        avatar: '🦊', desc: '狡猾多变/伪装高手，让人捉摸不透的存在' },
  { id: 'dawei',    name: 'Dawei (大伟)',       avatar: '🛡️', desc: '铁壁防守/团队守护者，最可靠的好人盾牌' },
  { id: 'xiaoming', name: 'Xiaoming (小明)',    avatar: '🎭', desc: '戏精本精/情报收集者，总是有出人意料的操作' },
  { id: 'mei',      name: 'Mei (小美)',         avatar: '🌸', desc: '新星崛起/潜力无限，成长速度惊人的新秀' },
  { id: 'jack',     name: 'Jack (杰克)',        avatar: '🃏', desc: '赌徒心态/高风险高回报，要么大赢要么大输' },
  { id: 'chen',     name: 'Chen (老陈)',        avatar: '🧠', desc: '老谋深算/经验丰富，用经验碾压一切花招' },
  { id: 'lily',     name: 'Lily (莉莉)',        avatar: '🌺', desc: '直觉型玩家/第六感超强，常有惊人的神预判' },
];

// ─── Script options ─────────────────────────────────────────────────────────────

const SCRIPTS = [
  '灾祸滋生 (Trouble Brewing)',
  '暗流涌动 (Bad Moon Rising)',
  '教派与紫罗兰 (Sects & Violets)',
  '黯月狂升 (Bad Moon Rising)',
  '梦境边缘 (Edge of Madness)',
  '实验场 (Experimental)',
];

// ─── Storyline templates ────────────────────────────────────────────────────────

const STORYLINES = [
  '一场惊心动魄的推理盛宴，最后时刻逆转！',
  '恶魔完美伪装，好人苦苦追寻真相',
  '关键信息在最后一轮浮出水面',
  '双面间谍让局势扑朔迷离',
  '新手的直觉拯救了整个好人阵营',
  '经验丰富的老手精准锁定恶魔',
  '一场充满欢笑和尖叫的周五之夜',
  '史诗级的嘴炮对决，全场高能',
  '最意想不到的人竟然是恶魔！',
  '好人阵营团结一致，完美配合获胜',
  null, // some games have no storyline
  null,
];

// ─── Mulberry32 PRNG (deterministic, seed-based) ───────────────────────────────

function mulberry32(seed) {
  let state = seed | 0;
  return function () {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Helper utilities that consume the PRNG ─────────────────────────────────────

/** Return a random integer in [min, max] (inclusive). */
function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Pick a random element from an array. */
function randPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Shuffle an array in-place (Fisher-Yates) using the PRNG. */
function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Friday date generator ──────────────────────────────────────────────────────

/**
 * Collect every Friday between two ISO date strings (inclusive range).
 */
function getFridaysBetween(startISO, endISO) {
  const fridays = [];
  const current = new Date(startISO);
  const end = new Date(endISO);

  // Advance to first Friday
  while (current.getDay() !== 5) {
    current.setDate(current.getDate() + 1);
  }

  while (current <= end) {
    fridays.push(current.toISOString().slice(0, 10)); // YYYY-MM-DD
    current.setDate(current.getDate() + 7);
  }

  return fridays;
}

// ─── Main seed function ─────────────────────────────────────────────────────────

export function seed() {
  // Idempotency check: bail out if players already seeded
  const existingPlayers = db.prepare('SELECT COUNT(*) AS count FROM players').get();
  if (existingPlayers.count > 0) {
    console.log('[seed] Players already exist – skipping seed.');
    return;
  }

  console.log('[seed] Seeding database …');

  // ── Insert default group ──────────────────────────────────────────────────
  const defaultGroupId = 'friday-night';
  const existingGroup = db.prepare('SELECT id FROM groups WHERE id = ?').get(defaultGroupId);
  if (!existingGroup) {
    db.prepare(
      'INSERT INTO groups (id, name, description, avatar) VALUES (?, ?, ?, ?)',
    ).run(defaultGroupId, '周五狂欢夜', '默认游戏组', null);
    console.log('[seed] Created default group: 周五狂欢夜');
  }

  // ── Insert official scripts ──────────────────────────────────────────────
  const OFFICIAL_SCRIPTS = [
    { name: '初来乍到 (Trouble Brewing)' },
    { name: '暗流涌动 (Bad Moon Rising)' },
    { name: '梦中杀机 (Sects & Violets)' },
    { name: '死亡秩序 (Deadly Penance Day)' },
  ];

  const insertScript = db.prepare(
    'INSERT OR IGNORE INTO scripts (id, name, group_id, characters, is_official) VALUES (?, ?, ?, ?, 1)'
  );
  for (const s of OFFICIAL_SCRIPTS) {
    const sid = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    insertScript.run(sid, s.name, defaultGroupId, '[]');
  }
  console.log('[seed] Inserted official scripts.');

  // ── Insert players ────────────────────────────────────────────────────────
  const insertPlayer = db.prepare(`
    INSERT INTO players (id, name, avatar, desc, is_system, group_id)
    VALUES (@id, @name, @avatar, @desc, 1, @group_id)
  `);

  const insertManyPlayers = db.transaction((players) => {
    for (const p of players) {
      insertPlayer.run({ ...p, group_id: defaultGroupId });
    }
  });

  insertManyPlayers(INITIAL_PLAYERS);
  console.log(`[seed] Inserted ${INITIAL_PLAYERS.length} players.`);

  // ── Generate 45 deterministic games ───────────────────────────────────────
  const rng = mulberry32(42);

  const fridays = getFridaysBetween('2025-06-01', '2026-06-20');
  // We need 45 Fridays; shuffle and pick 45
  const selectedFridays = shuffle(rng, [...fridays]).slice(0, 45).sort();

  const insertGame = db.prepare(`
    INSERT INTO games (id, date, script, winner, storyline, mvp_player_id, notes, created_by, group_id)
    VALUES (@id, @date, @script, @winner, @storyline, @mvp_player_id, @notes, @created_by, @group_id)
  `);

  const insertParticipant = db.prepare(`
    INSERT INTO game_participants (game_id, player_id, role_type, survived, final_round, correct_vote)
    VALUES (@game_id, @player_id, @role_type, @survived, @final_round, @correct_vote)
  `);

  // Player IDs for easy reference
  const allPlayerIds = INITIAL_PLAYERS.map((p) => p.id);
  // "Star" players appear in ~90% of games
  const starPlayers = ['ash', 'kangbo'];

  const insertAllGames = db.transaction(() => {
    for (let i = 0; i < 45; i++) {
      const gameId = `game-${String(i + 1).padStart(3, '0')}`;
      const date = selectedFridays[i];
      const script = randPick(rng, SCRIPTS);

      // 55% good wins
      const winner = rng() < 0.55 ? 'good' : 'evil';

      const storyline = randPick(rng, STORYLINES);

      // Select 7-12 participants
      const numPlayers = randInt(rng, 7, 12);
      const pool = shuffle(rng, [...allPlayerIds]);

      // Guarantee star players appear ~90% of the time
      let selected = [];
      for (const star of starPlayers) {
        if (rng() < 0.9) {
          selected.push(star);
        }
      }

      // Fill remaining slots from the pool (avoid duplicates)
      for (const pid of pool) {
        if (selected.length >= numPlayers) break;
        if (!selected.includes(pid)) {
          selected.push(pid);
        }
      }

      // Shuffle participant order for role assignment fairness
      shuffle(rng, selected);

      // ── Assign roles ──────────────────────────────────────────────────────
      // Exactly 1 demon, 1-2 minions, 1-2 outsiders, rest townsfolk
      const numMinions = randInt(rng, 1, 2);
      const numOutsiders = randInt(rng, 1, 2);
      const roles = [];

      roles.push('demon'); // index 0
      for (let m = 0; m < numMinions; m++) roles.push('minion');
      for (let o = 0; o < numOutsiders; o++) roles.push('outsider');
      while (roles.length < selected.length) roles.push('townsfolk');

      // Bias: Ash & Kangbo get townsfolk more often (heroes!)
      // They are already shuffled into `selected`; just let the random
      // assignment stand – but give them a stat boost below.

      // Determine MVP: pick someone from the winning side
      // For simplicity, just pick a random participant
      const mvpPlayerId = randPick(rng, selected);

      // Insert the game row
      insertGame.run({
        id: gameId,
        date,
        script,
        winner,
        storyline: storyline || null,
        mvp_player_id: mvpPlayerId,
        notes: null,
        created_by: null, // seeded games have no creator
        group_id: defaultGroupId,
      });

      // Insert participants
      for (let p = 0; p < selected.length; p++) {
        const playerId = selected[p];
        const roleType = roles[p];

        // Survival: ~50% survive, star players survive slightly more
        let surviveChance = 0.5;
        if (starPlayers.includes(playerId)) surviveChance = 0.65;
        const survived = rng() < surviveChance ? 1 : 0;

        // Final round participation: ~60%
        const finalRound = rng() < 0.6 ? 1 : 0;

        // Correct vote: ~45%, star players ~65%
        let voteChance = 0.45;
        if (starPlayers.includes(playerId)) voteChance = 0.65;
        const correctVote = rng() < voteChance ? 1 : 0;

        insertParticipant.run({
          game_id: gameId,
          player_id: playerId,
          role_type: roleType,
          survived,
          final_round: finalRound,
          correct_vote: correctVote,
        });
      }
    }
  });

  insertAllGames();
  console.log('[seed] Inserted 45 mock games with participants.');

  // ── Migrate existing data with NULL group_id ──────────────────────────────
  const migratedPlayers = db.prepare('UPDATE players SET group_id = ? WHERE group_id IS NULL').run(defaultGroupId);
  const migratedGames = db.prepare('UPDATE games SET group_id = ? WHERE group_id IS NULL').run(defaultGroupId);
  if (migratedPlayers.changes > 0 || migratedGames.changes > 0) {
    console.log(`[seed] Migrated ${migratedPlayers.changes} players and ${migratedGames.changes} games to default group.`);
  }

  console.log('[seed] Done ✓');
}

// Allow running directly: `node seed.js`
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seed();
}
