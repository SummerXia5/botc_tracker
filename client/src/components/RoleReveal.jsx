import { useState, useEffect, useRef } from 'react';
import { getRevealSession, sitRevealSeat, unseatRevealSeat, getMyChar } from '../api';
import { CHARACTERS, TYPE_COLORS, TYPE_LABELS, TRAVELLERS } from '../data/characters';
import './RoleReveal.css';

/**
 * RoleReveal v3 — deferred reveal:
 *   1. Enter 4-digit code
 *   2. Pick name + seat
 *   3. Wait for ALL players to be seated
 *   4. Character auto-revealed when everyone is ready
 */
export default function RoleReveal({ onClose }) {
  const [code, setCode] = useState('');
  const [session, setSession] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [customName, setCustomName] = useState('');
  const [revealedChar, setRevealedChar] = useState(null);
  const [revealedInfo, setRevealedInfo] = useState(null);
  const [mySeatIndex, setMySeatIndex] = useState(null); // seat I claimed
  const [myPlayerName, setMyPlayerName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  const allChars = { ...CHARACTERS, ...TRAVELLERS };

  // Poll session every 3 seconds for real-time updates
  // If seated but not revealed, also check for allSeated → auto fetch char
  useEffect(() => {
    if (!session || revealedChar) return;
    const poll = async () => {
      try {
        const data = await getRevealSession(code);
        setSession(data);
        // If I'm seated and everyone is seated, fetch my character
        if (mySeatIndex !== null && data.allSeated) {
          try {
            const charData = await getMyChar(code, mySeatIndex);
            setRevealedChar({
              name: charData.characterName,
              nameEn: charData.characterNameEn,
              icon: charData.characterIcon,
              ability: charData.characterAbility,
              type: charData.characterType,
              id: charData.characterId,
            });
            setRevealedInfo({
              playerName: myPlayerName,
              seatIndex: mySeatIndex,
              seatNumber: mySeatIndex + 1,
            });
            if (pollRef.current) clearInterval(pollRef.current);
          } catch (_) {}
        }
      } catch (e) {
        // session expired
      }
    };
    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current);
  }, [session, code, revealedChar, mySeatIndex, myPlayerName]);

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
      // Seated but no character yet — wait for everyone
      setMySeatIndex(data.seatIndex);
      setMyPlayerName(data.playerName);
      // If already all seated, immediately fetch character
      if (data.allSeated) {
        try {
          const charData = await getMyChar(code, data.seatIndex);
          setRevealedChar({
            name: charData.characterName,
            nameEn: charData.characterNameEn,
            icon: charData.characterIcon,
            ability: charData.characterAbility,
            type: charData.characterType,
            id: charData.characterId,
          });
          setRevealedInfo({
            playerName: data.playerName,
            seatIndex: data.seatIndex,
            seatNumber: data.seatNumber,
          });
          if (pollRef.current) clearInterval(pollRef.current);
        } catch (_) {}
      }
      // Refresh session
      const refreshed = await getRevealSession(code);
      setSession(refreshed);
    } catch (e) {
      setError(e.message || '入座失败');
      try {
        const refreshed = await getRevealSession(code);
        setSession(refreshed);
      } catch (_) {}
    }
    setLoading(false);
  };

  // ── Step 3a: Seated, waiting for everyone ──
  if (mySeatIndex !== null && !revealedChar && session) {
    return (
      <div className="reveal-page">
        <div className="reveal-card" style={{ textAlign: 'center' }}>
          <h2 className="reveal-title">⏳ 等待中...</h2>
          <div style={{ fontSize: '0.85rem', color: '#8a7a5a', marginBottom: 16 }}>
            {myPlayerName} · 座位 {mySeatIndex + 1}
          </div>
          <div style={{
            fontSize: '0.9rem', fontWeight: 600,
            color: session.allSeated ? '#a0d4a0' : '#d4b878',
            marginBottom: 12,
          }}>
            {session.allSeated
              ? '✅ 所有玩家已入座！正在获取角色...'
              : `入座进度: ${session.seatedCount} / ${session.totalSeats}`
            }
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
            gap: 6, textAlign: 'left', marginBottom: 16,
          }}>
            {session.seats.map(seat => (
              <div key={seat.seatIndex} style={{
                padding: '6px 8px', borderRadius: 8, fontSize: '0.7rem',
                background: seat.occupied ? 'rgba(100,180,100,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${seat.occupied ? 'rgba(100,180,100,0.3)' : 'rgba(100,80,50,0.15)'}`,
                color: seat.occupied ? '#a0d4a0' : '#6a5a3a',
              }}>
                <span style={{ fontWeight: 700 }}>{seat.seatNumber}.</span>{' '}
                {seat.occupied ? seat.playerName : '空座'}
              </div>
            ))}
          </div>
          <button
            className="reveal-btn"
            style={{ background: 'rgba(180,80,80,0.3)', borderColor: 'rgba(180,80,80,0.5)' }}
            onClick={async () => {
              if (window.confirm('确定要起立吗？')) {
                try {
                  await unseatRevealSeat(code, mySeatIndex);
                  setMySeatIndex(null);
                  setMyPlayerName('');
                  setSelectedPlayer(null);
                  setCustomName('');
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
    );
  }

  // ── Step 3b: Character revealed ──
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
