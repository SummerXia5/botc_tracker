import { useEffect, useState, useMemo } from 'react';
import './Dashboard.css';

export default function Dashboard({ stats, games = [], playersWithStats = [] }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Top 3 most played scripts
  const topScripts = useMemo(() => {
    const counts = {};
    for (const g of games) {
      const name = g.script || '标准剧本';
      counts[name] = (counts[name] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [games]);

  // Players currently on a win streak ≥ 2
  const hotStreakPlayers = useMemo(() => {
    return playersWithStats
      .filter(p => p.currentWinStreak >= 2)
      .sort((a, b) => b.currentWinStreak - a.currentWinStreak);
  }, [playersWithStats]);

  // Unique players active in the last 30 days
  const activePlayers30d = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const playerIds = new Set();
    for (const g of games) {
      if (new Date(g.date) >= cutoff && g.participants) {
        for (const p of g.participants) {
          playerIds.add(p.player_id);
        }
      }
    }
    return playerIds.size;
  }, [games]);

  if (!stats) return null;

  const goodPct = (stats.goodWinRate * 100).toFixed(1);
  const evilPct = (stats.evilWinRate * 100).toFixed(1);

  return (
    <section className="dashboard-section">
      <div className="section-header">
        <h2 className="section-title">数据总览</h2>
        <span className="section-subtitle">STATISTICS OVERVIEW</span>
      </div>

      <div className="dashboard-grid">
        {/* Total Games — hero card */}
        <div className="stat-card stat-card-hero">
          <span className="stat-label">总对局数</span>
          <span className={`stat-number hero-number ${animated ? 'animate' : ''}`}>
            {stats.totalGames}
          </span>
          <span className="stat-unit">GAMES PLAYED</span>
        </div>

        {/* Avg Players */}
        <div className="stat-card">
          <span className="stat-label">平均玩家数</span>
          <span className={`stat-number ${animated ? 'animate' : ''}`}>
            {stats.avgPlayers}
          </span>
          <span className="stat-unit">AVG PLAYERS / GAME</span>
        </div>

        {/* Active Players (30 days) */}
        <div className="stat-card">
          <span className="stat-label">👥 活跃玩家</span>
          <span className={`stat-number ${animated ? 'animate' : ''}`}>
            {activePlayers30d}
          </span>
          <span className="stat-unit">ACTIVE LAST 30 DAYS</span>
        </div>

        {/* Good vs Evil */}
        <div className="stat-card stat-card-versus">
          <span className="stat-label">善恶对决</span>
          <div className="versus-bar-container">
            <div className="versus-bar">
              <div
                className="versus-fill versus-good"
                style={{ width: animated ? `${Math.max(Number(goodPct) > 0 ? 15 : 0, goodPct)}%` : '0%' }}
              >
                {Number(goodPct) > 0 && <span className="versus-text">好人 {goodPct}%</span>}
              </div>
              <div
                className="versus-fill versus-evil"
                style={{ width: animated ? `${Math.max(Number(evilPct) > 0 ? 15 : 0, evilPct)}%` : '0%' }}
              >
                {Number(evilPct) > 0 && <span className="versus-text">坏人 {evilPct}%</span>}
              </div>
            </div>
          </div>
          <div className="versus-legend">
            <span className="legend-item legend-good">
              <span className="legend-dot" />
              善良阵营 {stats.goodWins}胜
            </span>
            <span className="legend-item legend-evil">
              <span className="legend-dot" />
              邪恶阵营 {stats.evilWins}胜
            </span>
          </div>
        </div>

        {/* Top Scripts */}
        {topScripts.length > 0 && (
          <div className="stat-card stat-card-scripts">
            <span className="stat-label">🎲 最热剧本</span>
            <div className="scripts-list">
              {topScripts.map((s, i) => (
                <div key={s.name} className="script-item">
                  <span className="script-rank">#{i + 1}</span>
                  <span className="script-name">{s.name}</span>
                  <span className="script-count">{s.count}局</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Win Streaks */}
        {hotStreakPlayers.length > 0 && (
          <div className="stat-card stat-card-streaks">
            <span className="stat-label">🔥 正在连胜</span>
            <div className="streaks-list">
              {hotStreakPlayers.map(p => (
                <div key={p.id} className="streak-item">
                  <span className="streak-emoji">{p.avatar || '🎮'}</span>
                  <span className="streak-name">{p.name}</span>
                  <span className="streak-count">{p.currentWinStreak}连胜</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Games */}
        <div className="stat-card stat-card-recent">
          <span className="stat-label">最近对局</span>
          <div className="recent-list">
            {stats.recentGames.map((game, i) => (
              <div key={game.id} className="recent-item">
                <span className="recent-date">
                  {new Date(game.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                </span>
                <span className="recent-script">{game.script || '标准剧本'}</span>
                <span className={`recent-winner winner-${game.winner}`}>
                  {game.winner === 'good' ? '善良' : '邪恶'}
                </span>
              </div>
            ))}
            {stats.recentGames.length === 0 && (
              <div className="recent-empty">暂无对局记录</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
