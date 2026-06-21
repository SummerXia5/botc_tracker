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

  // Power Score (25-100 scale)
  const gamesBonus = Math.min(totalGames / 30, 1); // caps at 30 games
  const rawScore =
    winRate * 30 +
    survivalRate * 20 +
    correctVoteRate * 25 +
    finalRoundRate * 15 +
    gamesBonus * 10;
  const powerScore = Math.round(Math.max(25, Math.min(100, rawScore)));

  // Star rating
  const starRating = getStarRating(powerScore);

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
