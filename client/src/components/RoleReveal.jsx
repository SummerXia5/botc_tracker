import { useState, useEffect, useRef } from 'react';
import { getRevealSession, sitRevealSeat, unseatRevealSeat } from '../api';
import { CHARACTERS, TYPE_COLORS, TYPE_LABELS, TRAVELLERS } from '../data/characters';
import './RoleReveal.css';

/**
 * RoleReveal v2 — new flow:
 *   1. Enter 4-digit code
 *   2. See seat map (available/taken) + pick your name from group list
 *   3. Pick an available seat → see your character
 */
export default function RoleReveal({ onClose }) {
  const [code, setCode] = useState('');
  const [session, setSession] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [customName, setCustomName] = useState('');
  const [revealedChar, setRevealedChar] = useState(null);
  const [revealedInfo, setRevealedInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  const allChars = { ...CHARACTERS, ...TRAVELLERS };

  // Poll session every 3 seconds for real-time updates
  useEffect(() => {
    if (!session || revealedChar) return;
    const poll = async () => {
      try {
        const data = await getRevealSession(code);
        setSession(data);
      } catch (e) {
        // session expired
      }
    };
    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current);
  }, [session, code, revealedChar]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleSubmitCode = async () => {
    if (code.length !== 4) {
      setError('请输入4位数字代码');
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

  const handleSit = async (seatIndex) => {
    const playerName = selectedPlayer ? selectedPlayer.name : customName.trim();
    if (!playerName) {
      setError('请先选择或输入你的名字');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await sitRevealSeat(code, {
        seatIndex,
        playerName,
        playerId: selectedPlayer?.id || null,
      });
      const ch = allChars[data.characterId];
      setRevealedChar(ch || { name: data.characterId, type: 'townsfolk' });
      setRevealedInfo(data);
      if (pollRef.current) clearInterval(pollRef.current);
    } catch (e) {
      setError(e.message || '入座失败');
      // Refresh session
      try {
        const refreshed = await getRevealSession(code);
        setSession(refreshed);
      } catch (_) {}
    }
    setLoading(false);
  };

  // ── Step 3: Character revealed ──
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
          <div className="reveal-player-name">{revealedInfo?.playerName}</div>
          <div className="reveal-seat-badge">座位 {revealedInfo?.seatNumber}</div>
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
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="reveal-btn" onClick={onClose}>关闭</button>
            <button
              className="reveal-btn"
              style={{ background: 'rgba(180,80,80,0.3)', borderColor: 'rgba(180,80,80,0.5)' }}
              onClick={async () => {
                if (window.confirm('确定要起立吗？你的角色信息将不再显示。')) {
                  try {
                    await unseatRevealSeat(code, revealedInfo.seatIndex);
                    setRevealedChar(null);
                    setRevealedInfo(null);
                    setSelectedPlayer(null);
                    setCustomName('');
                    // Refresh session
                    const data = await getRevealSession(code);
                    setSession(data);
                  } catch (e) { console.error('Unseat failed:', e); }
                }
              }}
            >
              🚶 起立
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Pick name + seat ──
  if (session) {
    const nameChosen = !!(selectedPlayer || customName.trim());

    return (
      <div className="reveal-page">
        <div className="reveal-card reveal-seat-card">
          <h2 className="reveal-title">🎭 选择座位</h2>
          <div className="reveal-script">{session.scriptName}</div>
          <div className="reveal-progress">
            {session.seatedCount} / {session.totalSeats} 已入座
          </div>
          {error && <div className="reveal-error">{error}</div>}

          {/* Step 2a: Choose your name */}
          <div className="reveal-section">
            <div className="reveal-section-title">① 选择你的名字</div>
            {session.availablePlayers.length > 0 && (
              <div className="reveal-name-list">
                {session.availablePlayers.map(p => (
                  <button
                    key={p.id}
                    className={`reveal-name-btn ${selectedPlayer?.id === p.id ? 'active' : ''}`}
                    onClick={() => { setSelectedPlayer(p); setCustomName(''); setError(''); }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <div className="reveal-name-custom">
              <input
                type="text"
                placeholder="或输入新名字..."
                value={customName}
                onChange={e => { setCustomName(e.target.value); setSelectedPlayer(null); }}
                className="reveal-name-input"
              />
            </div>
            {nameChosen && (
              <div className="reveal-chosen-name">
                ✓ {selectedPlayer ? selectedPlayer.name : customName.trim()}
              </div>
            )}
          </div>

          {/* Step 2b: Choose seat */}
          <div className="reveal-section">
            <div className="reveal-section-title">② 选择座位号</div>
            <div className="reveal-seat-grid">
              {session.seats.map(seat => (
                <button
                  key={seat.seatIndex}
                  className={`reveal-seat-btn ${seat.occupied ? 'occupied' : ''}`}
                  disabled={seat.occupied || loading || !nameChosen}
                  onClick={() => handleSit(seat.seatIndex)}
                >
                  <span className="reveal-seat-number">{seat.seatNumber}</span>
                  {seat.occupied ? (
                    <span className="reveal-seat-taken">{seat.playerName}</span>
                  ) : (
                    <span className="reveal-seat-empty">空位</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <button className="reveal-btn reveal-btn-back" onClick={() => { setSession(null); setSelectedPlayer(null); setCustomName(''); }}>
            ← 返回
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1: Enter code ──
  return (
    <div className="reveal-page">
      <div className="reveal-card">
        <h2 className="reveal-title">🔮 角色抽取</h2>
        <p className="reveal-subtitle">输入说书人提供的4位代码</p>
        {error && <div className="reveal-error">{error}</div>}
        <div className="reveal-code-input">
          <input
            type="text"
            maxLength={4}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0000"
            className="reveal-code-field"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSubmitCode()}
          />
        </div>
        <button
          className="reveal-btn"
          disabled={code.length !== 4 || loading}
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
