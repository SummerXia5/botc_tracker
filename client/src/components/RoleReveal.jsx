import { useState } from 'react';
import { getRevealSession, claimRevealSeat } from '../api';
import { CHARACTERS, TYPE_COLORS, TYPE_LABELS, TRAVELLERS } from '../data/characters';
import './RoleReveal.css';

/**
 * RoleReveal — standalone page for players to claim their seat and see their role.
 * Flow:
 *   1. Enter 6-digit code
 *   2. See player list → pick your name
 *   3. See your character (revealed!)
 */
export default function RoleReveal({ onClose }) {
  const [code, setCode] = useState('');
  const [session, setSession] = useState(null);
  const [revealedChar, setRevealedChar] = useState(null);
  const [revealedPlayer, setRevealedPlayer] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Build character lookup
  const allChars = { ...CHARACTERS, ...TRAVELLERS };

  const handleSubmitCode = async () => {
    if (code.length !== 6) {
      setError('请输入6位数字代码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await getRevealSession(code);
      setSession(data);
    } catch (e) {
      setError('代码无效或已过期');
    }
    setLoading(false);
  };

  const handleClaimSeat = async (seatIndex) => {
    setLoading(true);
    setError('');
    try {
      const data = await claimRevealSeat(code, seatIndex);
      const ch = allChars[data.characterId];
      setRevealedChar(ch || { name: data.characterId, type: 'townsfolk' });
      setRevealedPlayer(data.playerName);
    } catch (e) {
      setError(e.message || '该座位已被认领');
    }
    setLoading(false);
  };

  // Step 3: Character revealed
  if (revealedChar) {
    return (
      <div className="reveal-page">
        <div className="reveal-card reveal-result">
          <div className="reveal-result-icon" style={{
            borderColor: TYPE_COLORS[revealedChar.type] || '#d4b878',
            boxShadow: `0 0 30px ${TYPE_COLORS[revealedChar.type]}50`,
          }}>
            {revealedChar.icon ? (
              <img src={revealedChar.icon} alt={revealedChar.name} className="reveal-char-img" />
            ) : (
              <span className="reveal-char-letter">{revealedChar.name?.charAt(0)}</span>
            )}
          </div>
          <div className="reveal-player-name">{revealedPlayer}</div>
          <div className="reveal-char-name" style={{ color: TYPE_COLORS[revealedChar.type] }}>
            {revealedChar.name}
          </div>
          <div className="reveal-char-en">{revealedChar.nameEn}</div>
          <div className="reveal-char-type" style={{
            color: TYPE_COLORS[revealedChar.type],
            borderColor: `${TYPE_COLORS[revealedChar.type]}40`,
          }}>
            {TYPE_LABELS[revealedChar.type] || revealedChar.type}
          </div>
          <div className="reveal-char-ability">{revealedChar.ability}</div>
          <div className="reveal-warning">
            ⚠ 请记住你的角色，此页面关闭后无法再次查看
          </div>
          <button className="reveal-btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    );
  }

  // Step 2: Select your name
  if (session) {
    return (
      <div className="reveal-page">
        <div className="reveal-card">
          <h2 className="reveal-title">🎭 选择你的身份</h2>
          <div className="reveal-script">{session.scriptName}</div>
          {error && <div className="reveal-error">{error}</div>}
          <div className="reveal-player-list">
            {session.players.map((p) => (
              <button
                key={p.seatIndex}
                className={`reveal-player-btn ${p.claimed ? 'claimed' : ''}`}
                disabled={p.claimed || loading}
                onClick={() => handleClaimSeat(p.seatIndex)}
              >
                <span className="reveal-seat-num">{p.seatIndex + 1}</span>
                <span className="reveal-player-label">{p.name}</span>
                {p.claimed && <span className="reveal-claimed-tag">已认领</span>}
              </button>
            ))}
          </div>
          <button className="reveal-btn reveal-btn-back" onClick={() => setSession(null)}>
            ← 返回
          </button>
        </div>
      </div>
    );
  }

  // Step 1: Enter code
  return (
    <div className="reveal-page">
      <div className="reveal-card">
        <h2 className="reveal-title">🔮 角色抽取</h2>
        <p className="reveal-subtitle">输入说书人提供的6位代码</p>
        {error && <div className="reveal-error">{error}</div>}
        <div className="reveal-code-input">
          <input
            type="text"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="reveal-code-field"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSubmitCode()}
          />
        </div>
        <button
          className="reveal-btn"
          disabled={code.length !== 6 || loading}
          onClick={handleSubmitCode}
        >
          {loading ? '查询中...' : '确认'}
        </button>
        <button className="reveal-btn reveal-btn-back" onClick={onClose}>
          返回
        </button>
      </div>
    </div>
  );
}
