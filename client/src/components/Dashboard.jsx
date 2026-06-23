import { useEffect, useState } from 'react';
import './Dashboard.css';

export default function Dashboard({ stats }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

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
