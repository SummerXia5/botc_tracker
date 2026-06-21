import { useState, useMemo } from 'react';
import './GameHistory.css';

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
                <div className="game-participants">
                  {game.participants.map((p, j) => {
                    const info = getPlayerName(p.player_id);
                    const isGood = p.role_type === 'townsfolk' || p.role_type === 'outsider';
                    const won = (isGood && game.winner === 'good') || (!isGood && game.winner === 'evil');
                    return (
                      <div key={j} className="game-participant">
                        <span className="gp-emoji">{info.emoji}</span>
                        <span className="gp-name">{info.name}</span>
                        <span
                          className="gp-role"
                          style={{
                            color: `var(--color-${p.role_type})`,
                          }}
                        >
                          {roleLabels[p.role_type] || p.role_type}
                        </span>
                        <span className="gp-survived">
                          {p.survived ? '✓' : '✗'}
                        </span>
                        <span className={`gp-result ${won ? 'result-win' : 'result-lose'}`}>
                          {won ? '胜' : '负'}
                        </span>
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
