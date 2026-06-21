import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { createPlayer, updatePlayer, deletePlayer } from '../api';
import { useToast } from './Toast';
import './PlayerManagement.css';

const EMOJI_OPTIONS = [
  '🎭', '🎪', '🦊', '🐺', '🦉', '🌙', '☀️', '⭐',
  '🔮', '⚡', '🛡️', '🗡️', '🎯', '💎', '🌊', '🔥',
  '🌸', '🎲', '🧠', '🦅', '🐉', '🌹', '👻', '🎃',
];

export default function PlayerManagement({ players, onRefresh }) {
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', avatar: '', desc: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', avatar: '🎭', desc: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(false);

  // ---- Add ----
  const handleAdd = async () => {
    if (!addForm.name.trim()) {
      toast.error('请输入玩家昵称');
      return;
    }
    setLoading(true);
    try {
      await createPlayer(addForm);
      toast.success(`已添加 ${addForm.name}`);
      setAddForm({ name: '', avatar: '🎭', desc: '' });
      setShowAdd(false);
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- Edit ----
  const startEdit = (player) => {
    setEditingId(player.id);
    setEditForm({
      name: player.name,
      avatar: player.avatar || '🎭',
      desc: player.desc || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', avatar: '', desc: '' });
  };

  const handleSave = async (id) => {
    if (!editForm.name.trim()) {
      toast.error('昵称不能为空');
      return;
    }
    setLoading(true);
    try {
      await updatePlayer(id, editForm);
      toast.success('已保存');
      setEditingId(null);
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- Delete ----
  const handleDelete = async (id, name) => {
    setLoading(true);
    try {
      await deletePlayer(id);
      toast.success(`已删除 ${name}`);
      setConfirmDelete(null);
      onRefresh();
    } catch (err) {
      toast.error(err.message);
      setConfirmDelete(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mgmt">
      <div className="mgmt-header">
        <div>
          <h2 className="mgmt-title">玩家管理</h2>
          <p className="mgmt-subtitle">PLAYER MANAGEMENT</p>
        </div>
        <span className="mgmt-count">{players.length} 位玩家</span>
      </div>

      {/* Add player inline form */}
      {isAuthenticated && !showAdd && (
        <button className="mgmt-add-btn" onClick={() => setShowAdd(true)}>
          + 添加玩家
        </button>
      )}

      {showAdd && (
        <div className="mgmt-add-form">
          <div className="mgmt-add-form-row">
            <div className="mgmt-form-field">
              <label>昵称</label>
              <input
                type="text"
                value={addForm.name}
                onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="玩家昵称"
                autoFocus
              />
            </div>
            <div className="mgmt-form-field">
              <label>描述</label>
              <input
                type="text"
                value={addForm.desc}
                onChange={e => setAddForm({ ...addForm, desc: e.target.value })}
                placeholder="一句话描述（选填）"
              />
            </div>
          </div>
          <div className="mgmt-form-field">
            <label>头像</label>
            <div className="mgmt-emoji-grid">
              {EMOJI_OPTIONS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  className={`mgmt-emoji-btn ${addForm.avatar === emoji ? 'active' : ''}`}
                  onClick={() => setAddForm({ ...addForm, avatar: emoji })}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="mgmt-add-actions">
            <button className="mgmt-btn-ghost" onClick={() => setShowAdd(false)}>取消</button>
            <button className="mgmt-btn-primary" onClick={handleAdd} disabled={loading}>
              {loading ? '添加中...' : '添加'}
            </button>
          </div>
        </div>
      )}

      {/* Player list */}
      <div className="mgmt-list">
        {players.map(player => (
          <div key={player.id} className="mgmt-row">
            {editingId === player.id ? (
              /* Edit mode */
              <div className="mgmt-edit-form">
                <div className="mgmt-edit-top">
                  <div className="mgmt-emoji-picker-inline">
                    {EMOJI_OPTIONS.slice(0, 12).map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        className={`mgmt-emoji-btn-sm ${editForm.avatar === emoji ? 'active' : ''}`}
                        onClick={() => setEditForm({ ...editForm, avatar: emoji })}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="mgmt-edit-fields">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="昵称"
                      className="mgmt-edit-input"
                    />
                    <input
                      type="text"
                      value={editForm.desc}
                      onChange={e => setEditForm({ ...editForm, desc: e.target.value })}
                      placeholder="描述（选填）"
                      className="mgmt-edit-input"
                    />
                  </div>
                </div>
                <div className="mgmt-edit-actions">
                  <button className="mgmt-btn-ghost-sm" onClick={cancelEdit}>取消</button>
                  <button className="mgmt-btn-primary-sm" onClick={() => handleSave(player.id)} disabled={loading}>
                    保存
                  </button>
                </div>
              </div>
            ) : (
              /* Display mode */
              <>
                <div className="mgmt-row-left">
                  <span className="mgmt-avatar">{player.avatar || '🎭'}</span>
                  <div className="mgmt-info">
                    <span className="mgmt-name">{player.name}</span>
                    {player.desc && <span className="mgmt-desc">{player.desc}</span>}
                  </div>
                </div>
                {isAuthenticated && (
                  <div className="mgmt-row-actions">
                    <button className="mgmt-action-btn" onClick={() => startEdit(player)} title="编辑">
                      编辑
                    </button>
                    {confirmDelete === player.id ? (
                      <span className="mgmt-confirm-delete">
                        <span className="mgmt-confirm-text">确定？</span>
                        <button className="mgmt-action-btn mgmt-action-danger" onClick={() => handleDelete(player.id, player.name)}>
                          删除
                        </button>
                        <button className="mgmt-action-btn" onClick={() => setConfirmDelete(null)}>
                          取消
                        </button>
                      </span>
                    ) : (
                      <button className="mgmt-action-btn mgmt-action-danger" onClick={() => setConfirmDelete(player.id)}>
                        删除
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {players.length === 0 && (
        <p className="mgmt-empty">暂无玩家数据</p>
      )}
    </section>
  );
}
