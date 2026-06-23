import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { createGroup, joinGroup } from '../api';
import { useToast } from './Toast';
import LoginModal from './LoginModal';
import './GroupSelector.css';

export default function GroupSelector({ groups, onSelectGroup, onRefresh, myGroupIds = [] }) {
  const { user, isAuthenticated, isStoryteller, logout } = useAuth();
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('请输入组名');
      return;
    }
    setSaving(true);
    try {
      await createGroup({ name: name.trim(), description: description.trim() });
      toast.success(`组 "${name}" 创建成功`);
      setName('');
      setDescription('');
      setShowCreate(false);
      onRefresh();
    } catch (err) {
      toast.error(err.message || '创建失败');
    } finally {
      setSaving(false);
    }
  };

  const handleJoin = async (e, groupId) => {
    e.stopPropagation();
    try {
      await joinGroup(groupId);
      toast.success('成功加入!');
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCancel = () => {
    setShowCreate(false);
    setName('');
    setDescription('');
  };

  return (
    <div className="group-selector">
      <div className="group-selector-header" style={{ position: 'relative' }}>
        <div className="header-accent-line" />
        <div className="header-actions">
          {isAuthenticated ? (
            <>
              <span className="header-user">{user?.displayName || user?.username}</span>
              <button className="btn btn-ghost" onClick={logout}>
                退出
              </button>
            </>
          ) : (
            <button className="btn btn-ghost" onClick={() => setShowLogin(true)}>
              登录 / 注册
            </button>
          )}
        </div>
      </div>

      <div className="group-selector-body">
        <div className="group-selector-title">
          <h1>血染钟楼</h1>
          <p>选择游戏组</p>
        </div>

        {groups.length === 0 && !showCreate && (
          <div className="group-empty">
            暂无游戏组
            {isAuthenticated && isStoryteller && '，点击下方创建'}
          </div>
        )}

        <div className="group-grid">
          {groups.map(group => (
            <div
              key={group.id}
              className="group-card"
              onClick={() => onSelectGroup(group)}
            >
              <div className="group-card-name">{group.name}</div>
              {group.description && (
                <div className="group-card-desc">{group.description}</div>
              )}
              {isAuthenticated && !isStoryteller && (
                myGroupIds.includes(group.id)
                  ? <span className="group-joined-badge">✓ 已加入</span>
                  : <button className="group-join-btn" onClick={(e) => handleJoin(e, group.id)}>加入</button>
              )}
              <span className="group-card-arrow">→</span>
            </div>
          ))}

          {isAuthenticated && isStoryteller && !showCreate && (
            <button
              className="group-card-create"
              onClick={() => setShowCreate(true)}
            >
              <span className="group-card-create-icon">+</span>
              创建新组
            </button>
          )}

          {showCreate && (
            <form className="group-create-form" onSubmit={handleCreate}>
              <div className="form-field">
                <label>组名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例: 周五狂欢夜"
                  autoFocus
                  maxLength={40}
                />
              </div>
              <div className="form-field">
                <label>描述（可选）</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="简短描述这个游戏组..."
                  rows={2}
                  maxLength={120}
                />
              </div>
              <div className="group-form-actions">
                <button type="button" className="btn-cancel" onClick={handleCancel}>
                  取消
                </button>
                <button type="submit" className="btn-save" disabled={saving || !name.trim()}>
                  {saving ? '创建中...' : '创建'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}
