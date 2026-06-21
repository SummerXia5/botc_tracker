import { useState } from 'react';
import { createPlayer } from '../api';
import { useToast } from './Toast';
import './AddPlayerModal.css';

const EMOJI_OPTIONS = [
  '😎', '🦊', '🐺', '🦁', '🐉', '🧙', '🧛', '👻', '💀', '🎃',
  '🌟', '🔥', '⚡', '🗡️', '🛡️', '👑', '🎯', '🎪', '🌙', '☀️',
  '🦅', '🐍', '🦇', '🐲', '🦄', '🧝', '🧟', '🤖', '👽', '🎭',
  '🏴‍☠️', '🃏', '🎲', '🔮', '💎', '🌹', '🍷', '⚔️', '🏹', '🪄',
];

export default function AddPlayerModal({ onClose, onSuccess, groupId }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('😎');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('请输入玩家名称');
      return;
    }

    setLoading(true);
    try {
      const playerData = { name: name.trim(), emoji, description: description.trim() };
      if (groupId) playerData.group_id = groupId;
      await createPlayer(playerData);
      toast.success(`玩家 ${name} 添加成功！`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || '添加失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container add-player-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="add-player-header">
          <h2>新增玩家</h2>
          <p className="add-player-subtitle">ADD NEW PLAYER</p>
        </div>

        <form className="add-player-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label>玩家昵称</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="输入玩家名称"
              autoFocus
              maxLength={20}
            />
          </div>

          <div className="form-field">
            <label>选择头像</label>
            <div className="emoji-grid">
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  type="button"
                  className={`emoji-option ${emoji === e ? 'emoji-selected' : ''}`}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label>个人描述</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="一句话描述这位玩家的风格..."
              rows={3}
              maxLength={100}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? '添加中...' : '添加玩家'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
