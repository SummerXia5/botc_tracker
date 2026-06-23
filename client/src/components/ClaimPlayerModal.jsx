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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container claim-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        
        <div className="claim-header">
          <h2>🎮 认领玩家档案</h2>
          <p className="claim-subtitle">在这个组中找到你自己的档案</p>
        </div>

        <div className="claim-list">
          {availablePlayers.length === 0 ? (
            <p className="claim-empty">没有可认领的玩家档案。{'\n'}请联系说书人添加你的档案。</p>
          ) : (
            availablePlayers.map(player => (
              <label
                key={player.id}
                className={`claim-player ${selectedId === player.id ? 'claim-player-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="claim-player"
                  checked={selectedId === player.id}
                  onChange={() => setSelectedId(player.id)}
                />
                <span className="claim-player-avatar">{player.avatar || '🎮'}</span>
                <div className="claim-player-info">
                  <span className="claim-player-name">{player.name}</span>
                  {player.desc && <span className="claim-player-desc">{player.desc}</span>}
                </div>
              </label>
            ))
          )}
        </div>

        <div className="claim-actions">
          <button
            className="btn btn-filled btn-full"
            onClick={handleClaim}
            disabled={!selectedId || claiming}
          >
            {claiming ? '认领中...' : '确认认领'}
          </button>
          <button className="btn btn-ghost btn-full" onClick={onClose}>
            稍后再说
          </button>
        </div>
      </div>
    </div>
  );
}
