import { useState, useMemo } from 'react';
import { CHARACTERS } from '../data/characters';
import './GameHistory.css';

const getCharacterName = (characterId) => {
  if (!characterId) return null;
  if (CHARACTERS[characterId]) return CHARACTERS[characterId].name;
  const stripped = characterId.replace(/CustomVER$/, '');
  return CHARACTERS[stripped]?.name || characterId;
};

const GAMES_PER_PAGE = 10;

export default function GameHistory({ games, players }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [games]);

  const totalPages = Math.ceil(sortedGames.length / GAMES_PER_PAGE);
  const pageGames = sortedGames.slice(
    (currentPage - 1) * GAMES_PER_PAGE,
    currentPage * GAMES_PER_PAGE
  );

  const getPlayerName = (playerId) => {
    const p = players.find(pl => pl.id === playerId);
    return p ? { name: p.name, emoji: p.emoji || '👤' } : { name: '未知', emoji: '?' };
  };

  const roleLabels = {
    townsfolk: '镇民',
    outsider: '外来者',
    minion: '爪牙',
    demon: '恶魔',
  };

  const achLabels = {
    logic_chain: '🧠 盘通逻辑线',
    perfect_review: '📖 完美复盘',
    strong_lead: '🏆 强势带队',
    wrong_lead: '💀 带偏方向',
    clutch_play: '⚡ 关键操作',
    great_bluff: '🎭 完美伪装',
  };

  return (
    <section className="game-history-section">
      <div className="section-header">
        <h2 className="section-title">
          对局历史
        </h2>
        <span className="section-subtitle">GAME HISTORY · {games.length} GAMES</span>
      </div>

      <div className="games-list">
        {pageGames.map((game, i) => (
          <div
            key={game.id}
            className={`game-card ${expandedId === game.id ? 'game-card-expanded' : ''}`}
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            <div
              className="game-card-main"
              onClick={() => setExpandedId(expandedId === game.id ? null : game.id)}
            >
              <div className="game-date">
                {new Date(game.date).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
              <div className="game-script">{game.script || '标准剧本'}</div>
              <div className={`game-winner-badge winner-badge-${game.winner}`}>
                {game.winner === 'good' ? '好人胜' : '坏人胜'}
              </div>
              <div className="game-player-avatars">
                {(game.participants || []).slice(0, 8).map((p, j) => {
                  const info = getPlayerName(p.player_id);
                  return (
                    <span key={j} className="game-avatar" title={info.name}>
                      {info.emoji}
                    </span>
                  );
                })}
                {(game.participants || []).length > 8 && (
                  <span className="game-avatar game-avatar-more">
                    +{game.participants.length - 8}
                  </span>
                )}
              </div>
              <span className="game-expand-icon">
                {expandedId === game.id ? '▲' : '▼'}
              </span>
            </div>

            {expandedId === game.id && game.participants && (
              <div className="game-details">
                {/* MVP indicator */}
                {game.mvp_player_id && (
                  <div className="game-mvp-row">
                    ⭐ MVP: <strong>{getPlayerName(game.mvp_player_id).name}</strong>
                  </div>
                )}
                <div className="game-participants">
                  {game.participants.map((p, j) => {
                    const info = getPlayerName(p.player_id);
                    const isGood = p.role_type === 'townsfolk' || p.role_type === 'outsider';
                    const won = (isGood && game.winner === 'good') || (!isGood && game.winner === 'evil');
                    const isMvp = game.mvp_player_id === p.player_id;
                    const achievements = (() => {
                      try {
                        const raw = p.achievements;
                        if (Array.isArray(raw)) return raw;
                        if (typeof raw === 'string') return JSON.parse(raw);
                        return [];
                      } catch { return []; }
                    })();
                    return (
                      <div key={j} className={`game-participant ${isMvp ? 'gp-mvp' : ''}`}>
                        <div className="gp-main-row">
                          <span className="gp-emoji">{p.player_avatar || info.emoji}</span>
                          <span className="gp-name">{p.player_name || info.name}</span>
                          <span
                            className="gp-role"
                            style={{ color: `var(--color-${p.role_type})` }}
                          >
                            {roleLabels[p.role_type] || p.role_type}
                          </span>
                          {p.character_id && (
                            <span className="gp-char" title={p.character_id}>
                              {getCharacterName(p.character_id)}
                            </span>
                          )}
                          <span className="gp-survived">
                            {p.survived ? '✓' : '✗'}
                          </span>
                          {p.survival_days != null && (
                            <span className="gp-days" title="存活天数">
                              {p.survival_days}天
                            </span>
                          )}
                          <span className={`gp-result ${won ? 'result-win' : 'result-lose'}`}>
                            {won ? '胜' : '负'}
                          </span>
                          {isMvp && <span className="gp-mvp-badge">⭐</span>}
                        </div>
                        {(achievements.length > 0 || p.player_notes) && (
                          <div className="gp-extra-row">
                            {achievements.length > 0 && (
                              <div className="gp-achievements">
                                {achievements.map(a => (
                                  <span key={a} className="gp-ach-tag">{achLabels[a] || a}</span>
                                ))}
                              </div>
                            )}
                            {p.player_notes && (
                              <span className="gp-note">📝 {p.player_notes}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}

        {pageGames.length === 0 && (
          <div className="no-games">
            <p>暂无对局记录</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="page-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            ← 上一页
          </button>
          <div className="page-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
              .map((page, i, arr) => {
                const prev = arr[i - 1];
                const showEllipsis = prev && page - prev > 1;
                return (
                  <span key={page}>
                    {showEllipsis && <span className="page-ellipsis">···</span>}
                    <button
                      className={`page-num ${currentPage === page ? 'page-num-active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  </span>
                );
              })}
          </div>
          <button
            className="page-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            下一页 →
          </button>
        </div>
      )}
    </section>
  );
}
