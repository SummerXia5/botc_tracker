import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin, register as apiRegister } from '../api';
import { useToast } from './Toast';
import './LoginModal.css';

export default function LoginModal({ onClose }) {
  const { login } = useAuth();
  const toast = useToast();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('player');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('请填写用户名和密码');
      return;
    }

    setLoading(true);
    try {
      let data;
      if (isRegister) {
        data = await apiRegister(username.trim(), password, role, displayName.trim() || username.trim());
        toast.success('注册成功！');
      } else {
        data = await apiLogin(username.trim(), password);
        toast.success('登录成功！');
      }
      login(data.user, data.token);
      onClose();
    } catch (err) {
      toast.error(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container login-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="login-header">
          <h2>{isRegister ? '创建账号' : '登录'}</h2>
          <p className="login-subtitle">
            {isRegister ? 'Create Account' : 'Sign In'}
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {isRegister && (
            <div className="role-picker">
              <p className="role-picker-label">我是：</p>
              <div className="role-picker-options">
                <button
                  type="button"
                  className={`role-option ${role === 'storyteller' ? 'role-option-active' : ''}`}
                  onClick={() => setRole('storyteller')}
                >
                  <span className="role-icon">📖</span>
                  <span className="role-name">说书人</span>
                  <span className="role-desc">创建组、管理对局</span>
                </button>
                <button
                  type="button"
                  className={`role-option ${role === 'player' ? 'role-option-active' : ''}`}
                  onClick={() => setRole('player')}
                >
                  <span className="role-icon">🎮</span>
                  <span className="role-name">玩家</span>
                  <span className="role-desc">加入组、查看数据</span>
                </button>
              </div>
            </div>
          )}

          <div className="form-field">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              autoFocus
            />
          </div>

          {isRegister && (
            <div className="form-field">
              <label>显示名称</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Display Name（选填，默认同用户名）"
              />
            </div>
          )}

          <div className="form-field">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
            />
          </div>

          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? '处理中...' : (isRegister ? '注册' : '登录')}
          </button>
        </form>

        <div className="login-toggle">
          <span className="text-muted">
            {isRegister ? '已有账号？' : '没有账号？'}
          </span>
          <button className="btn-link" onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? '去登录' : '去注册'}
          </button>
        </div>
      </div>
    </div>
  );
}
