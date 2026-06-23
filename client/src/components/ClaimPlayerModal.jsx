import { useState } from 'react';
import { claimPlayer } from '../api';
import { useToast } from './Toast';
import './ClaimPlayerModal.css';

export default function ClaimPlayerModal({ players, onClose, onClaimed }) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState(null);
  const [claiming, setClaiming] = useState(false);

  // Only show unclaimed players (no user_id)
  const availablePlayers = players.filter(p => !p.user_id);

  const handleClaim = async () => {
    if (!selectedId) {
      toast.error('请选择一个玩家档案');
      return;
    }
    setClaiming(true);
    try {
      await claimPlayer(selectedId);
      toast.success('成功认领玩家档案!');
      onClaimed();
      onClose();
    } catch (err) {
      toast.error(err.message || '认领失败');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="claim-overlay" onClick={onClose}>
      <div className="claim-modal" onClick={e => e.stopPropagation()}>
        <button className="claim-close" onClick={onClose}>✕</button>

        {/* Decorative header */}
        <div className="claim-hero">
          <div className="claim-hero-glow" />
          <div className="claim-hero-icon">🎭</div>
          <h2 className="claim-title">选择你的身份</h2>
          <p className="claim-subtitle">找到你在这个组中的玩家档案</p>
        </div>

        <div className="claim-body">
          {availablePlayers.length === 0 ? (
            <div className="claim-empty">
              <span className="claim-empty-icon">📋</span>
              <p>暂无可认领的档案</p>
              <p className="claim-empty-hint">请联系说书人添加你的玩家档案</p>
            </div>
          ) : (
            <div className="claim-list">
              {availablePlayers.map(player => (
                <div
                  key={player.id}
                  className={`claim-card ${selectedId === player.id ? 'claim-card--selected' : ''}`}
                  onClick={() => setSelectedId(player.id)}
                >
                  <div className="claim-card-check">
                    <div className="claim-radio">
                      {selectedId === player.id && <div className="claim-radio-dot" />}
                    </div>
                  </div>
                  <div className="claim-card-avatar">{player.avatar || '🎮'}</div>
                  <div className="claim-card-info">
                    <span className="claim-card-name">{player.name}</span>
                    {player.desc && <span className="claim-card-desc">{player.desc}</span>}
                  </div>
                  <span className="claim-card-arrow">→</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="claim-footer">
          <button
            className="claim-btn-confirm"
            onClick={handleClaim}
            disabled={!selectedId || claiming}
          >
            {claiming ? (
              <><span className="claim-btn-spinner" /> 认领中...</>
            ) : (
              <>✓ 确认认领</>
            )}
          </button>
          <button className="claim-btn-skip" onClick={onClose}>
            稍后再说
          </button>
        </div>
      </div>
    </div>
  );
}
