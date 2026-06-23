import RadarChart from './RadarChart';
import { getRadarDimensions, getPowerTier, ROLE_INFO } from '../utils/stats';
import { CHARACTERS } from '../data/characters';
import './PlayerModal.css';

const getCharacterName = (characterId) => {
  if (!characterId) return null;
  if (CHARACTERS[characterId]) return CHARACTERS[characterId].name;
  const stripped = characterId.replace(/Custom(?:VER)?$/i, '').replace(/_custom$/i, '');
  if (CHARACTERS[stripped]) return CHARACTERS[stripped].name;
  const lower = stripped.toLowerCase();
  if (CHARACTERS[lower]) return CHARACTERS[lower].name;
  const allChars = Object.values(CHARACTERS);
  const byEn = allChars.find(c => c.nameEn?.toLowerCase() === lower || c.nameEn?.toLowerCase().replace(/\s+/g, '') === lower);
  if (byEn) return byEn.name;
  return stripped.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const ACH_META = {
  logic_chain: { icon: '🧠', label: '盘通逻辑线' },
  perfect_review: { icon: '📖', label: '完美复盘' },
  strong_lead: { icon: '🏆', label: '强势带队' },
  wrong_lead: { icon: '💀', label: '带偏方向' },
  clutch_play: { icon: '⚡', label: '关键操作' },
  great_bluff: { icon: '🎭', label: '完美伪装' },
};

export default function PlayerModal({ player, onClose }) {
  if (!player) return null;

  const tier = getPowerTier(player.powerScore);
  const radarDimensions = getRadarDimensions(player);

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-modal" onClick={e => e.stopPropagation()}>
        <button className="pm-close" onClick={onClose}>×</button>

        {/* ---- Header ---- */}
        <div className="pm-header">
          <div className="pm-avatar">{player.avatar || '👤'}</div>
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

        {/* ---- Core Stats Grid ---- */}
        <div className="pm-stats">
          <h3 className="pm-section-title">核心数据</h3>
          <div className="pm-stat-grid">
            <div className="pm-stat-cell">
              <span className="pm-stat-label">总对战</span>
              <span className="pm-stat-value">{player.totalGames} 局</span>
            </div>
            <div className="pm-stat-cell">
              <span className="pm-stat-label">综合胜率</span>
              <span className="pm-stat-value pm-stat-value--accent">
                {(player.winRate * 100).toFixed(1)}%
              </span>
            </div>
            <div className="pm-stat-cell">
              <span className="pm-stat-label">🏆 MVP</span>
              <span className="pm-stat-value pm-stat-value--gold">
                {player.mvpCount || 0} 次
              </span>
            </div>
            <div className="pm-stat-cell">
              <span className="pm-stat-label">生存率</span>
              <span className="pm-stat-value">
                {(player.survivalRate * 100).toFixed(1)}%
              </span>
            </div>
            {player.avgSurvivalDays != null && (
              <div className="pm-stat-cell">
                <span className="pm-stat-label">平均存活</span>
                <span className="pm-stat-value">
                  {player.avgSurvivalDays.toFixed(1)} 天
                </span>
              </div>
            )}
            {player.maxWinStreak > 0 && (
              <div className="pm-stat-cell">
                <span className="pm-stat-label">🔥 最长连胜</span>
                <span className="pm-stat-value pm-stat-value--accent">
                  {player.maxWinStreak} 连胜
                </span>
              </div>
            )}
          </div>

          {/* Current streak banner */}
          {player.currentWinStreak >= 2 && (
            <div className="pm-streak-banner">
              🔥 当前 {player.currentWinStreak} 连胜中！
            </div>
          )}
        </div>

        {/* ---- Top Characters ---- */}
        {player.topCharacters && player.topCharacters.length > 0 && (
          <div className="pm-stats">
            <h3 className="pm-section-title">常用角色</h3>
            <div className="pm-char-list">
              {player.topCharacters.map(ch => {
                const charData = CHARACTERS[ch.id] || CHARACTERS[ch.id.replace(/Custom(?:VER)?$/i, '')] || CHARACTERS[ch.id.toLowerCase()];
                const name = getCharacterName(ch.id);
                const typeColor = charData ? `var(--color-${charData.type})` : 'var(--text-secondary)';
                return (
                  <div key={ch.id} className="pm-char-row">
                    <span className="pm-char-icon" style={{ color: typeColor }}>
                      {charData?.icon && charData.icon.includes('/')
                        ? <img src={charData.icon} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
                        : (charData?.icon || name?.charAt(0) || '?')}
                    </span>
                    <span className="pm-char-name">{name}</span>
                    <span className="pm-char-count">{ch.games}局</span>
                    <span className="pm-char-rate" style={{ color: ch.winRate >= 0.5 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {(ch.winRate * 100).toFixed(0)}%胜
                    </span>
                    <div className="pm-char-bar">
                      <div className="pm-char-bar-fill" style={{ width: `${ch.winRate * 100}%`, background: ch.winRate >= 0.5 ? 'var(--accent-green)' : 'var(--accent-red)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---- Achievements ---- */}
        {player.achievementCounts && Object.keys(player.achievementCounts).length > 0 && (
          <div className="pm-stats">
            <h3 className="pm-section-title">成就徽章</h3>
            <div className="pm-ach-grid">
              {Object.entries(player.achievementCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([key, count]) => {
                  const meta = ACH_META[key] || { icon: '🏅', label: key };
                  return (
                    <div key={key} className="pm-ach-badge">
                      <span className="pm-ach-icon">{meta.icon}</span>
                      <span className="pm-ach-label">{meta.label}</span>
                      <span className="pm-ach-count">×{count}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ---- Role Breakdown ---- */}
        <div className="pm-stats">
          <h3 className="pm-section-title">阵营表现</h3>
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
              近期对局 ({player.recentGames.length}局)
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
                    {game.character_id && (
                      <span className="pm-history-char">
                        {getCharacterName(game.character_id)}
                      </span>
                    )}
                    <span className={`pm-history-result ${game.won ? 'pm-result--win' : 'pm-result--lose'}`}>
                      {game.won ? '胜' : '负'}
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
