import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import LoginModal from './LoginModal';
import './Header.css';

export default function Header({ onAddPlayer, onRecordGame, onManageScripts, onOpenGrimoire, selectedGroup, onBack }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <header className="app-header">
        <div className="header-accent-line" />
        <div className="header-content">
          <div className="header-brand">
            {selectedGroup && (
              <button className="header-back-btn" onClick={onBack}>
                ← 返回
              </button>
            )}
            <div className="header-titles">
              {selectedGroup ? (
                <>
                  <h1 className="header-title">{selectedGroup.name}</h1>
                  {selectedGroup.description && (
                    <p className="header-subtitle">{selectedGroup.description}</p>
                  )}
                </>
              ) : (
                <>
                  <h1 className="header-title">血染钟楼 · 周五狂欢夜</h1>
                  <p className="header-subtitle">FRIDAY NIGHT CLOCKTOWER ARENA</p>
                </>
              )}
            </div>
          </div>

          <div className="header-actions">
            {isAuthenticated ? (
              <>
                <span className="header-user">{user?.username}</span>
                <button className="btn btn-outlined" onClick={onAddPlayer}>
                  ⚙ 管理
                </button>
                <button className="btn btn-filled" onClick={onRecordGame}>
                  记录赛果
                </button>
                {onOpenGrimoire && (
                  <button className="btn btn-grimoire" onClick={onOpenGrimoire}>
                    说书人魔典 <span className="beta-badge">Beta</span>
                  </button>
                )}
                <button className="btn btn-ghost" onClick={logout}>
                  退出
                </button>
              </>
            ) : (
              <button className="btn btn-ghost" onClick={() => setShowLogin(true)}>
                管理员登录
              </button>
            )}
          </div>
        </div>
      </header>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
