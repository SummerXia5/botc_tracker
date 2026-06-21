import RadarChart from './RadarChart';
import { getRadarDimensions, getPowerTier, ROLE_INFO } from '../utils/stats';
import './PlayerModal.css';

export default function PlayerModal({ player, onClose }) {
  if (!player) return null;

  const tier = getPowerTier(player.powerScore);
  const radarDimensions = getRadarDimensions(player);
  const stars = '★'.repeat(player.starRating) + '☆'.repeat(5 - player.starRating);

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-modal" onClick={e => e.stopPropagation()}>
        <button className="pm-close" onClick={onClose}>×</button>

        {/* ---- Header ---- */}
        <div className="pm-header">
          <div className="pm-avatar">{player.emoji || '👤'}</div>
          <div className="pm-name-area">
            <div className="pm-name-row">
              <h2 className="pm-name">{player.name}</h2>
              <span
                className="pm-rank-pill"
                style={{ color: tier.color, background: tier.bg }}
              >
                RANK #{player.rank || '—'}
              </span>
            </div>
            <p className="pm-file-id">个人档案编号：{player.id}</p>
          </div>
          {player.description && (
            <blockquote className="pm-quote">
              {player.description}
            </blockquote>
          )}
        </div>

        {/* ---- Radar ---- */}
        <div className="pm-radar">
          <span className="pm-radar-badge">五维战力矩阵</span>
          <RadarChart dimensions={radarDimensions} size={260} />
        </div>

        {/* ---- Stats ---- */}
        <div className="pm-stats">
          <h3 className="pm-section-title">
            阵营表现与对决深度剖析
          </h3>

          <div className="pm-stat-grid">
            <div className="pm-stat-cell">
              <span className="pm-stat-label">总对战局数</span>
              <span className="pm-stat-value">{player.totalGames} 局</span>
            </div>
            <div className="pm-stat-cell">
              <span className="pm-stat-label">综合胜率</span>
              <span className="pm-stat-value pm-stat-value--accent">
                {(player.winRate * 100).toFixed(1)}%
              </span>
            </div>
            <div className="pm-stat-cell">
              <span className="pm-stat-label">决赛生存率</span>
              <span className="pm-stat-value">
                {(player.finalRoundRate * 100).toFixed(1)}%
              </span>
            </div>
            <div className="pm-stat-cell">
              <span className="pm-stat-label">正确投票率</span>
              <span className="pm-stat-value pm-stat-value--accent">
                {(player.correctVoteRate * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Role breakdown */}
          <div className="pm-role-grid">
            {Object.entries(ROLE_INFO).map(([key, info]) => {
              const rs = player.roleStats?.[key] || { games: 0, wins: 0, winRate: 0 };
              return (
                <div key={key} className="pm-role-cell" data-role={key}>
                  <div className="pm-role-name">
                    <span className="pm-role-cn">{info.label}</span>
                    <span className="pm-role-en">{info.labelEn}</span>
                  </div>
                  <div className="pm-role-data">
                    <span className="pm-role-count">{rs.games} 局</span>
                    <span className="pm-role-rate" data-role={key}>
                      {rs.games > 0 ? `${(rs.winRate * 100).toFixed(0)}%` : '—'}
                    </span>
                  </div>
                  {rs.games > 0 && (
                    <div className="pm-role-bar">
                      <div
                        className="pm-role-bar-fill"
                        data-role={key}
                        style={{ width: `${rs.winRate * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ---- Recent Games ---- */}
        {player.recentGames && player.recentGames.length > 0 && (
          <div className="pm-history">
            <h3 className="pm-section-title">
              个人历史角色演职明细 ({player.recentGames.length}局)
            </h3>
            <div className="pm-history-list">
              {player.recentGames.map((game, i) => (
                <div key={game.id || i} className="pm-history-row">
                  <div className="pm-history-left">
                    <span className="pm-history-script">{game.script || '标准'}</span>
                    <span className="pm-history-date">
                      {new Date(game.date).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <div className="pm-history-right">
                    <span className="pm-history-role" data-role={game.role_type}>
                      {ROLE_INFO[game.role_type]?.label}
                    </span>
                    <span className={`pm-history-result ${game.won ? 'pm-result--win' : 'pm-result--lose'}`}>
                      {game.won ? '胜利 WIN' : '败战'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
