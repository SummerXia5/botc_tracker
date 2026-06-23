/**
 * Player statistics calculation utilities.
 * All stats are computed client-side from games + participants data.
 */

/**
 * Compute detailed stats for a single player from their game participations.
 * @param {object} player - Player object with id, name, emoji, description
 * @param {Array} games - Array of game objects, each with participants array
 * @returns {object} Player with computed stats
 */
export function computePlayerStats(player, games) {
  const participations = [];

  for (const game of games) {
    if (!game.participants) continue;
    const entry = game.participants.find(p => p.player_id === player.id);
    if (entry) {
      participations.push({ ...entry, game });
    }
  }

  const totalGames = participations.length;

  if (totalGames === 0) {
    return {
      ...player,
      totalGames: 0,
      winRate: 0,
      survivalRate: 0,
      correctVoteRate: 0,
      finalRoundRate: 0,
      powerScore: 25,
      starRating: 1,
      roleStats: {},
      recentGames: [],
    };
  }

  // Overall win rate
  const wins = participations.filter(p => {
    const isGood = p.role_type === 'townsfolk' || p.role_type === 'outsider';
    return (isGood && p.game.winner === 'good') || (!isGood && p.game.winner === 'evil');
  }).length;
  const winRate = wins / totalGames;

  // Survival rate
  const survived = participations.filter(p => p.survived).length;
  const survivalRate = survived / totalGames;

  // Final round appearances
  const finalRoundAppearances = participations.filter(p => p.final_round).length;
  const finalRoundRate = finalRoundAppearances / totalGames;

  // Correct vote rate (only among final round appearances)
  const correctVotes = participations.filter(p => p.final_round && p.correct_vote).length;
  const correctVoteRate = finalRoundAppearances > 0 ? correctVotes / finalRoundAppearances : 0;

  // Role-specific win rates
  const roleTypes = ['townsfolk', 'outsider', 'minion', 'demon'];
  const roleStats = {};
  for (const role of roleTypes) {
    const roleGames = participations.filter(p => p.role_type === role);
    const roleWins = roleGames.filter(p => {
      const isGood = role === 'townsfolk' || role === 'outsider';
      return (isGood && p.game.winner === 'good') || (!isGood && p.game.winner === 'evil');
    }).length;
    roleStats[role] = {
      games: roleGames.length,
      wins: roleWins,
      winRate: roleGames.length > 0 ? roleWins / roleGames.length : 0,
    };
  }

  // Good / Evil specific win rates (for radar chart)
  const goodGames = participations.filter(p => p.role_type === 'townsfolk' || p.role_type === 'outsider');
  const goodWins = goodGames.filter(p => p.game.winner === 'good').length;
  const goodWinRate = goodGames.length > 0 ? goodWins / goodGames.length : 0;

  const evilGames = participations.filter(p => p.role_type === 'minion' || p.role_type === 'demon');
  const evilWins = evilGames.filter(p => p.game.winner === 'evil').length;
  const evilWinRate = evilGames.length > 0 ? evilWins / evilGames.length : 0;

  // ============================================================
  // Power Score (25-100 scale) — Multi-factor rating system
  // ============================================================
  //
  // Base components (max 60 pts):
  //   - Good win rate:  goodWinRate * 15   (max 15)
  //   - Evil win rate:  evilWinRate * 15   (max 15)
  //   - Survival rate:  survivalRate * 10  (max 10)
  //   - Correct vote:   correctVoteRate * 10 (max 10)
  //   - Experience:     min(totalGames/20, 1) * 10 (max 10)
  //
  // MVP bonus (max 15 pts):
  //   - Each MVP = 3 pts, capped at 15
  //
  // Achievement bonus (max 25 pts, can go negative):
  //   - 完美复盘 (perfect_review): +5 each
  //   - 盘通逻辑线 (logic_chain): +4 each
  //   - 关键操作 (clutch_play):    +3 each
  //   - 完美伪装 (great_bluff):    +3 each
  //   - 强势带队 (strong_lead):    +2 each
  //   - 带偏方向 (wrong_lead):     -3 each (penalty!)
  //
  const gamesBonus = Math.min(totalGames / 20, 1);
  const baseScore =
    goodWinRate * 15 +
    evilWinRate * 15 +
    survivalRate * 10 +
    correctVoteRate * 10 +
    gamesBonus * 10;

  // MVP bonus
  const mvpCount = games.filter(g => g.mvp_player_id === player.id).length;
  const mvpBonus = Math.min(mvpCount * 3, 15);

  // Achievement bonus
  const achWeights = {
    perfect_review: 5,
    logic_chain: 4,
    clutch_play: 3,
    great_bluff: 3,
    strong_lead: 2,
    wrong_lead: -3,
  };
  let achBonus = 0;
  // We need to compute achievements here for the score
  // (the full achievementCounts is computed later, but we need it now)
  for (const p of participations) {
    let achs = [];
    try {
      achs = typeof p.achievements === 'string' ? JSON.parse(p.achievements) : (p.achievements || []);
    } catch { achs = []; }
    for (const a of achs) {
      achBonus += (achWeights[a] || 1);
    }
  }
  // Cap achievement bonus between -10 and 25
  achBonus = Math.max(-10, Math.min(25, achBonus));

  const rawScore = baseScore + mvpBonus + achBonus;
  const powerScore = Math.round(Math.max(25, Math.min(100, rawScore)));

  // Star rating
  const starRating = getStarRating(powerScore);

  // mvpCount already computed above in power score section

  // Top characters played (with per-character win rate)
  const charCounts = {};
  for (const p of participations) {
    if (!p.character_id) continue;
    if (!charCounts[p.character_id]) charCounts[p.character_id] = { games: 0, wins: 0 };
    charCounts[p.character_id].games++;
    const isGood = p.role_type === 'townsfolk' || p.role_type === 'outsider';
    const won = (isGood && p.game.winner === 'good') || (!isGood && p.game.winner === 'evil');
    if (won) charCounts[p.character_id].wins++;
  }
  const topCharacters = Object.entries(charCounts)
    .map(([id, data]) => ({ id, games: data.games, wins: data.wins, winRate: data.wins / data.games }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 5);

  // Average survival days
  const daysEntries = participations.filter(p => p.survival_days != null && p.survival_days > 0);
  const avgSurvivalDays = daysEntries.length > 0
    ? (daysEntries.reduce((sum, p) => sum + p.survival_days, 0) / daysEntries.length)
    : null;
  const maxSurvivalDays = daysEntries.length > 0
    ? Math.max(...daysEntries.map(p => p.survival_days))
    : null;

  // Achievement counts
  const achievementCounts = {};
  for (const p of participations) {
    let achs = [];
    try {
      achs = typeof p.achievements === 'string' ? JSON.parse(p.achievements) : (p.achievements || []);
    } catch { achs = []; }
    for (const a of achs) {
      achievementCounts[a] = (achievementCounts[a] || 0) + 1;
    }
  }

  // Win/Loss streaks
  const sortedByDate = [...participations].sort((a, b) => new Date(a.game.date) - new Date(b.game.date));
  let currentStreak = 0;
  let maxWinStreak = 0;
  let streakType = null; // 'win' or 'lose'
  for (const p of sortedByDate) {
    const isGood = p.role_type === 'townsfolk' || p.role_type === 'outsider';
    const won = (isGood && p.game.winner === 'good') || (!isGood && p.game.winner === 'evil');
    if (won) {
      if (streakType === 'win') { currentStreak++; } else { currentStreak = 1; streakType = 'win'; }
      if (currentStreak > maxWinStreak) maxWinStreak = currentStreak;
    } else {
      if (streakType === 'lose') { currentStreak++; } else { currentStreak = 1; streakType = 'lose'; }
    }
  }
  const currentWinStreak = streakType === 'win' ? currentStreak : 0;

  // Recent games (last 10)
  const recentGames = participations
    .sort((a, b) => new Date(b.game.date) - new Date(a.game.date))
    .slice(0, 10)
    .map(p => ({
      id: p.game.id,
      date: p.game.date,
      script: p.game.script,
      winner: p.game.winner,
      role_type: p.role_type,
      survived: p.survived,
      character_id: p.character_id,
      won: (
        ((p.role_type === 'townsfolk' || p.role_type === 'outsider') && p.game.winner === 'good') ||
        ((p.role_type === 'minion' || p.role_type === 'demon') && p.game.winner === 'evil')
      ),
    }));

  return {
    ...player,
    totalGames,
    winRate,
    survivalRate,
    correctVoteRate,
    finalRoundRate,
    powerScore,
    starRating,
    roleStats,
    goodWinRate,
    evilWinRate,
    recentGames,
    mvpCount,
    topCharacters,
    avgSurvivalDays,
    maxSurvivalDays,
    achievementCounts,
    currentWinStreak,
    maxWinStreak,
  };
}

/**
 * Get star rating from power score.
 */
export function getStarRating(score) {
  if (score >= 86) return 5;
  if (score >= 71) return 4;
  if (score >= 56) return 3;
  if (score >= 41) return 2;
  return 1;
}

/**
 * Get power score tier info.
 */
export function getPowerTier(score) {
  if (score >= 86) return { label: 'S', color: '#D4A853', bg: 'rgba(212, 168, 83, 0.12)' };
  if (score >= 71) return { label: 'A', color: '#8B6BAE', bg: 'rgba(139, 107, 174, 0.12)' };
  if (score >= 56) return { label: 'B', color: '#5B8DB8', bg: 'rgba(91, 141, 184, 0.12)' };
  if (score >= 41) return { label: 'C', color: '#6B9E78', bg: 'rgba(107, 158, 120, 0.12)' };
  return { label: 'D', color: '#78716C', bg: 'rgba(120, 113, 108, 0.12)' };
}

/**
 * Get radar chart dimensions for a player.
 * Returns 5 values 0-100.
 */
export function getRadarDimensions(player) {
  return [
    { label: '逻辑推理', value: Math.round(player.correctVoteRate * 100), key: 'logic' },
    { label: '演技伪装', value: Math.round((player.evilWinRate || 0) * 100), key: 'acting' },
    { label: '生存大师', value: Math.round(player.survivalRate * 100), key: 'survival' },
    { label: '决赛决策', value: Math.round(player.finalRoundRate * 100), key: 'final' },
    { label: '团队领袖', value: Math.round((player.goodWinRate || 0) * 100), key: 'leadership' },
  ];
}

/**
 * Compute dashboard-level stats from games data.
 */
export function computeDashboardStats(games) {
  const totalGames = games.length;
  const goodWins = games.filter(g => g.winner === 'good').length;
  const evilWins = games.filter(g => g.winner === 'evil').length;
  const goodWinRate = totalGames > 0 ? goodWins / totalGames : 0;
  const evilWinRate = totalGames > 0 ? evilWins / totalGames : 0;

  const totalParticipants = games.reduce((sum, g) => sum + (g.participants?.length || 0), 0);
  const avgPlayers = totalGames > 0 ? (totalParticipants / totalGames).toFixed(1) : 0;

  const recentGames = [...games]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return {
    totalGames,
    goodWins,
    evilWins,
    goodWinRate,
    evilWinRate,
    avgPlayers,
    recentGames,
  };
}

/**
 * Get Hall of Fame awards from computed player stats.
 * Only players with 5+ games are eligible.
 */
export function computeHallOfFame(playersWithStats) {
  const eligible = playersWithStats.filter(p => p.totalGames >= 5);
  if (eligible.length === 0) return [];

  const awards = [];

  // MVP - highest power score
  const mvp = [...eligible].sort((a, b) => b.powerScore - a.powerScore)[0];
  awards.push({
    key: 'mvp',
    emoji: '🏆',
    title: '天命 MVP',
    subtitle: 'Most Valuable Player',
    player: mvp,
    value: `${mvp.powerScore}分`,
    isMvp: true,
  });

  // Logic Master - highest correct vote rate
  const logicMaster = [...eligible].sort((a, b) => b.correctVoteRate - a.correctVoteRate)[0];
  awards.push({
    key: 'logic',
    emoji: '🔍',
    title: '逻辑大师',
    subtitle: 'Logic Master',
    player: logicMaster,
    value: `${(logicMaster.correctVoteRate * 100).toFixed(0)}%`,
  });

  // Acting Master - best evil win rate (need at least some evil games)
  const evilPlayers = eligible.filter(p => (p.roleStats.minion?.games || 0) + (p.roleStats.demon?.games || 0) >= 2);
  if (evilPlayers.length > 0) {
    const actingMaster = [...evilPlayers].sort((a, b) => (b.evilWinRate || 0) - (a.evilWinRate || 0))[0];
    awards.push({
      key: 'acting',
      emoji: '🎭',
      title: '伪装戏骨',
      subtitle: 'Master of Disguise',
      player: actingMaster,
      value: `${((actingMaster.evilWinRate || 0) * 100).toFixed(0)}%`,
    });
  }

  // Survivor - highest survival rate
  const survivor = [...eligible].sort((a, b) => b.survivalRate - a.survivalRate)[0];
  awards.push({
    key: 'survivor',
    emoji: '🛡️',
    title: '不倒行者',
    subtitle: 'The Survivor',
    player: survivor,
    value: `${(survivor.survivalRate * 100).toFixed(0)}%`,
  });

  // Final Round Voter
  const finalRounder = [...eligible].sort((a, b) => b.finalRoundRate - a.finalRoundRate)[0];
  awards.push({
    key: 'final',
    emoji: '🗳️',
    title: '决绝一票',
    subtitle: 'Final Round Expert',
    player: finalRounder,
    value: `${(finalRounder.finalRoundRate * 100).toFixed(0)}%`,
  });

  return awards;
}

/**
 * Sort players by different criteria.
 */
export function sortPlayers(players, sortKey) {
  const sorted = [...players];
  switch (sortKey) {
    case 'power':
      return sorted.sort((a, b) => b.powerScore - a.powerScore);
    case 'winRate':
      return sorted.sort((a, b) => b.winRate - a.winRate);
    case 'correctVote':
      return sorted.sort((a, b) => b.correctVoteRate - a.correctVoteRate);
    case 'finalRound':
      return sorted.sort((a, b) => b.finalRoundRate - a.finalRoundRate);
    case 'games':
      return sorted.sort((a, b) => b.totalGames - a.totalGames);
    default:
      return sorted.sort((a, b) => b.powerScore - a.powerScore);
  }
}

/**
 * Role type display info.
 */
export const ROLE_INFO = {
  townsfolk: { label: '镇民', labelEn: 'Townsfolk', color: 'var(--color-townsfolk)' },
  outsider: { label: '外来者', labelEn: 'Outsider', color: 'var(--color-outsider)' },
  minion: { label: '爪牙', labelEn: 'Minion', color: 'var(--color-minion)' },
  demon: { label: '恶魔', labelEn: 'Demon', color: 'var(--color-demon)' },
};
