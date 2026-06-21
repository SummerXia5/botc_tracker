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
        data = await apiRegister(username.trim(), password);
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
          <h2>{isRegister ? '注册账号' : '管理员登录'}</h2>
          <p className="login-subtitle">
            {isRegister ? 'Create Admin Account' : 'Admin Authentication'}
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
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
