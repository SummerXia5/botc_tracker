import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
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
  const [showingChar, setShowingChar] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  // ── Notebook state ──
  const [showNotebook, setShowNotebook] = useState(false);
  const [notebookData, setNotebookData] = useState({ seats: {} });
  const [guessSearch, setGuessSearch] = useState({});   // { [seatIndex]: string }
  const [activeGuess, setActiveGuess] = useState(null);  // seatIndex with open dropdown / edit modal
  const [showSecretChar, setShowSecretChar] = useState(false); // hide secret role by default in notebook
  const [showDeathTable, setShowDeathTable] = useState(false); // toggle for Daily Death Table
  const notebookPollRef = useRef(null);

  // ── Notebook zoom/pan state (touch drag & pinch / mouse drag & wheel) ──
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const isPinchingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const lastPinchDistRef = useRef(0);
  const circleAreaRef = useRef(null);

  const allChars = { ...CHARACTERS, ...TRAVELLERS };

  // ── Load notebook from localStorage ──
  useEffect(() => {
    if (!code) return;
    try {
      const saved = localStorage.getItem(`notebook_${code}`);
      if (saved) setNotebookData(JSON.parse(saved));
    } catch (_) {}
  }, [code]);

  // ── Save notebook to localStorage ──
  const saveNotebook = useCallback((data) => {
    setNotebookData(data);
    if (code) {
      try { localStorage.setItem(`notebook_${code}`, JSON.stringify(data)); } catch (_) {}
    }
  }, [code]);

  const updateSeatData = useCallback((seatIndex, field, value) => {
    setNotebookData(prev => {
      const next = {
        ...prev,
        seats: {
          ...prev.seats,
          [seatIndex]: { ...(prev.seats[seatIndex] || {}), [field]: value },
        },
      };
      if (code) {
        try { localStorage.setItem(`notebook_${code}`, JSON.stringify(next)); } catch (_) {}
      }
      return next;
    });
  }, [code]);

  const resetNotebook = useCallback(() => {
    if (!window.confirm('确定要清空所有笔记吗？')) return;
    const empty = { seats: {} };
    saveNotebook(empty);
  }, [saveNotebook]);

  // ── Reset zoom/pan when opening notebook ──
  useEffect(() => {
    if (showNotebook) {
      setScale(1);
      setPan({ x: 0, y: 0 });
    }
  }, [showNotebook]);

  // ── Attach non-passive wheel listener for desktop zooming ──
  useEffect(() => {
    const el = circleAreaRef.current;
    if (!el || !showNotebook) return;
    const handleWheel = (e) => {
      e.preventDefault();
      setScale(prev => Math.min(2.5, Math.max(0.35, +(prev - e.deltaY * 0.0015).toFixed(3))));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [showNotebook]);

  // ── Touch / Mouse drag & pinch handlers for circle area ──
  const handleStartDrag = (e) => {
    if (e.target.closest('input, textarea, button, .notebook-guess-dropdown, .notebook-guess-display, .notebook-header, .notebook-zoom-controls')) {
      return;
    }
    if (e.touches && e.touches.length === 2) {
      isDraggingRef.current = false;
      isPinchingRef.current = true;
      lastPinchDistRef.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      return;
    }
    isDraggingRef.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    lastPosRef.current = { x: clientX, y: clientY };
  };

  const handleMoveDrag = (e) => {
    if (isPinchingRef.current && e.touches && e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastPinchDistRef.current > 0) {
        const ratio = dist / lastPinchDistRef.current;
        setScale(prev => Math.min(2.5, Math.max(0.35, +(prev * ratio).toFixed(3))));
      }
      lastPinchDistRef.current = dist;
      return;
    }
    if (!isDraggingRef.current) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - lastPosRef.current.x;
    const dy = clientY - lastPosRef.current.y;
    lastPosRef.current = { x: clientX, y: clientY };
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handleEndDrag = () => {
    isDraggingRef.current = false;
    isPinchingRef.current = false;
  };

  // ── Poll session while notebook is open (to get updated player names) ──
  useEffect(() => {
    if (!showNotebook || !code) return;
    const poll = async () => {
      try {
        const data = await getRevealSession(code);
        setSession(data);
      } catch (_) {}
    };
    notebookPollRef.current = setInterval(poll, 5000);
    return () => clearInterval(notebookPollRef.current);
  }, [showNotebook, code]);

  // Poll session every 3 seconds for real-time updates
  // If seated but not revealed, also check for allSeated → auto fetch char
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
    // Dev mode: 0000 or 0012 creates a 12-player session, 0007 creates a 7-player session
    if (code === '0000' || code === '0012' || code === '0007') {
      const is12 = code !== '0007';
      const devNames = is12
        ? ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kelly', 'Leo']
        : ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace'];
      const devChars = is12
        ? ['washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortune_teller', 'undertaker', 'monk', 'ravenkeeper', 'virgin', 'slayer', 'imp']
        : ['washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'imp', 'poisoner'];
      const mockSession = {
        scriptName: `暗流涌动 (Dev Mode ${is12 ? '12人' : '7人'})`,
        totalSeats: devNames.length,
        seatedCount: devNames.length,
        allSeated: true,
        seats: devNames.map((name, i) => ({
          seatIndex: i,
          seatNumber: i + 1,
          occupied: true,
          playerName: name,
          alive: i !== 1 && i !== 4 && i !== 7 && i !== 10, // Some seats marked dead for realistic testing
          deathDay: i === 1 ? 1 : i === 4 ? 1 : i === 7 ? 2 : i === 10 ? 2 : null,
          deathCause: i === 1 ? 'killed_night' : i === 4 ? 'executed' : i === 7 ? 'killed_night' : i === 10 ? 'executed' : null,
        })),
        availablePlayers: [],
      };
      setSession(mockSession);
      setMySeatIndex(0);
      setMyPlayerName('Alice');
      const ch = allChars[devChars[0]];
      if (ch) {
        setRevealedChar(ch);
        setRevealedInfo({ seatNumber: 1, playerName: 'Alice' });
        setShowingChar(true);
      }
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

  // ── Step 3a: Seated, waiting / ready ──
  if (mySeatIndex !== null && !(revealedChar && showingChar) && session) {
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
              ? '✅ 所有玩家已入座！'
              : `⏳ 入座进度: ${session.seatedCount} / ${session.totalSeats}`
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
          {session.allSeated ? (
            <button
              className="reveal-btn"
              style={{ fontSize: '1.1rem', padding: '14px 32px', background: 'rgba(100,180,100,0.2)', borderColor: 'rgba(100,180,100,0.5)' }}
              onClick={async () => {
                if (revealedChar) {
                  // Already fetched, just show
                  setShowingChar(true);
                  return;
                }
                setLoading(true);
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
                  setShowingChar(true);
                  if (pollRef.current) clearInterval(pollRef.current);
                } catch (e) {
                  setError('获取角色失败，请重试');
                }
                setLoading(false);
              }}
              disabled={loading}
            >
              🔮 查看身份
            </button>
          ) : (
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
          )}
        </div>
      </div>
    );
  }

  // ── Notebook: character guess helpers ──
  const charList = Object.values(allChars);

  const getFilteredChars = (seatIndex) => {
    const q = (guessSearch[seatIndex] || '').toLowerCase();
    if (!q) return charList.slice(0, 30);
    return charList.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.nameEn.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    ).slice(0, 30);
  };

  // ── Step 3b: Character revealed ──
  if (revealedChar) {
    // ── Notebook overlay ──
    if (showNotebook && session) {
      const seats = session.seats || [];
      const total = seats.length;
      return (
        <div className="notebook-overlay">
          {/* Header */}
          <div className="notebook-header">
            <div className="notebook-header-left">
              <button className="notebook-back-btn" onClick={() => setShowNotebook(false)}>← 返回</button>
              <div>
                <span className="notebook-title">📓 笔记本</span>
                {session.scriptName && <span className="notebook-script">· {session.scriptName}</span>}
              </div>
            </div>
            <div className="notebook-header-right">
              {revealedChar && (
                <div
                  className="notebook-my-char"
                  onClick={() => setShowSecretChar(prev => !prev)}
                  title="点击显示/隐藏自身秘密身份"
                  style={{ cursor: 'pointer' }}
                >
                  {showSecretChar ? (
                    <>
                      {revealedChar.icon && <img src={revealedChar.icon} className="notebook-my-char-icon" alt="" />}
                      <span className="notebook-my-char-name">{revealedChar.name}</span>
                      <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>👁️</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '0.85rem' }}>🔒</span>
                      <span className="notebook-my-char-name">我的身份 (已隐藏)</span>
                    </>
                  )}
                </div>
              )}
              <button
                className="notebook-reset-btn"
                style={{
                  background: showDeathTable ? 'rgba(232, 200, 100, 0.25)' : undefined,
                  color: showDeathTable ? '#fff' : undefined,
                  borderColor: showDeathTable ? '#e8c864' : undefined
                }}
                onClick={() => setShowDeathTable(prev => !prev)}
              >
                {showDeathTable ? '⭕ 座位圈' : '📜 阵亡时间表'}
              </button>
              <button className="notebook-reset-btn" onClick={resetNotebook}>🗑 清空</button>
            </div>
          </div>

          {/* If showDeathTable is true, show the Game Death Log table instead of circle area */}
          {showDeathTable ? (
            <div className="notebook-death-table-container">
              <div className="notebook-death-table-top">
                <h3 className="notebook-death-table-title">📜 每日生死与阵亡记录统计表</h3>
                <span className="notebook-death-table-sub">
                  (已阵亡玩家: {seats.filter(s => (notebookData.seats[s.seatIndex]?.dead || !s.alive)).length} / {seats.length} 人)
                </span>
              </div>
              <div className="notebook-death-table-wrapper">
                <table className="notebook-death-table">
                  <thead>
                    <tr>
                      <th style={{ width: '20%' }}>游戏天数</th>
                      <th style={{ width: '40%' }}>☀️ 白天阵亡 (被处决 / 白天技能)</th>
                      <th style={{ width: '40%' }}>🌙 夜晚阵亡 (恶魔击杀 / 夜晚技能)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(day => {
                      const dayDeaths = seats.filter(s => {
                        const sd = notebookData.seats[s.seatIndex] || {};
                        const isDead = sd.dead !== undefined ? sd.dead : !s.alive;
                        if (!isDead) return false;
                        const d = sd.deathDay != null ? sd.deathDay : s.deathDay;
                        const p = sd.deathPhase || (s.deathCause?.includes('night') ? 'night' : s.deathCause ? 'day' : null);
                        return d === day && p === 'day';
                      });
                      const nightDeaths = seats.filter(s => {
                        const sd = notebookData.seats[s.seatIndex] || {};
                        const isDead = sd.dead !== undefined ? sd.dead : !s.alive;
                        if (!isDead) return false;
                        const d = sd.deathDay != null ? sd.deathDay : s.deathDay;
                        const p = sd.deathPhase || (s.deathCause?.includes('night') ? 'night' : s.deathCause ? 'day' : null);
                        return d === day && p === 'night';
                      });

                      // Don't render empty rows far beyond Day 3 unless there's data
                      if (dayDeaths.length === 0 && nightDeaths.length === 0 && day > (session?.dayNumber || 3)) return null;

                      return (
                        <tr key={day}>
                          <td className="death-table-day">第 {day} 天</td>
                          <td className="death-table-cell">
                            {dayDeaths.length > 0 ? (
                              <div className="death-table-player-list">
                                {dayDeaths.map(s => {
                                  const gc = (notebookData.seats[s.seatIndex] || {}).charGuess;
                                  const ch = gc ? allChars[gc] : null;
                                  return (
                                    <span key={s.seatIndex} className="death-table-player-tag type-day">
                                      <span className="death-tag-num">#{s.seatNumber}</span>
                                      <span className="death-tag-name">{s.occupied ? s.playerName : '空座'}</span>
                                      {ch && <span className="death-tag-role" style={{ color: TYPE_COLORS[ch.type] }}>({ch.name})</span>}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : <span className="death-table-none">—</span>}
                          </td>
                          <td className="death-table-cell">
                            {nightDeaths.length > 0 ? (
                              <div className="death-table-player-list">
                                {nightDeaths.map(s => {
                                  const gc = (notebookData.seats[s.seatIndex] || {}).charGuess;
                                  const ch = gc ? allChars[gc] : null;
                                  return (
                                    <span key={s.seatIndex} className="death-table-player-tag type-night">
                                      <span className="death-tag-num">#{s.seatNumber}</span>
                                      <span className="death-tag-name">{s.occupied ? s.playerName : '空座'}</span>
                                      {ch && <span className="death-tag-role" style={{ color: TYPE_COLORS[ch.type] }}>({ch.name})</span>}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : <span className="death-table-none">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="notebook-death-table-tip">
                💡 提示：在上方或座位编辑弹窗的「笔记下方」设置玩家的具体阵亡天数与时段，即可在此自动归纳汇总！
              </div>
            </div>
          ) : (

          {/* Circle area with touch drag & pinch zoom */}
          <div
            ref={circleAreaRef}
            className="notebook-circle-area"
            onClick={() => setActiveGuess(null)}
            onMouseDown={handleStartDrag}
            onMouseMove={handleMoveDrag}
            onMouseUp={handleEndDrag}
            onMouseLeave={handleEndDrag}
            onTouchStart={handleStartDrag}
            onTouchMove={handleMoveDrag}
            onTouchEnd={handleEndDrag}
          >
            {/* Zoom / Pan floating controls */}
            <div className="notebook-zoom-controls" onClick={e => e.stopPropagation()}>
              <button className="notebook-zoom-btn" onClick={() => setScale(s => Math.min(2.5, +(s + 0.15).toFixed(2)))} title="放大">＋</button>
              <button className="notebook-zoom-btn" onClick={() => setScale(s => Math.max(0.35, +(s - 0.15).toFixed(2)))} title="缩小">－</button>
              <button className="notebook-zoom-btn" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} title="居中/复位">⊙</button>
            </div>

            <div
              className="notebook-circle-container"
              style={{
                '--seat-size': (() => {
                  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 700;
                  if (total <= 10) return isMobile ? '76px' : '96px';
                  if (total <= 13) return isMobile ? '62px' : '84px';
                  return isMobile ? '56px' : '72px';
                })(),
                transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              }}
            >
              {/* Center decoration */}
              <div className="notebook-center-label">
                <div className="notebook-center-icon">🩸</div>
                <div className="notebook-center-text">血染钟楼</div>
              </div>

              {seats.map((seat, idx) => {
                const seatData = notebookData.seats[seat.seatIndex] || {};
                const isMe = seat.seatIndex === mySeatIndex;
                const guessCharId = seatData.charGuess;
                const guessChar = guessCharId ? allChars[guessCharId] : null;

                // Balanced 4:5 elliptical layout on mobile portrait for even 12-player distribution
                const isMobilePortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth + 80 && window.innerWidth <= 700;
                const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
                const radiusX = isMobilePortrait ? (total <= 10 ? 38 : 40) : (total <= 10 ? 36 : total <= 13 ? 39 : 42);
                const radiusY = isMobilePortrait ? (total <= 10 ? 40 : 41) : (total <= 10 ? 36 : total <= 13 ? 39 : 42);
                const cx = 50 + radiusX * Math.cos(angle);
                const cy = 50 + radiusY * Math.sin(angle);

                return (
                  <div
                    key={seat.seatIndex}
                    className={[
                      'seat-token',
                      !seat.alive && 'dead',
                      guessChar && `type-${guessChar.type}`,
                      isMe && 'notebook-my-token-border',
                    ].filter(Boolean).join(' ')}
                    style={{ left: `${cx}%`, top: `${cy}%` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveGuess(seat.seatIndex); // Open seat editor popup
                    }}
                  >
                    {/* Shroud if dead (synced from Storyteller Grimoire!) */}
                    {!seat.alive && (
                      <div className="seat-shroud">
                        <span className="death-cause-badge">💀</span>
                      </div>
                    )}

                    {/* Note indicator badge if player wrote notes */}
                    {seatData.notes && (
                      <div className="notebook-token-note-badge" title="已有笔记">📝</div>
                    )}

                    {/* Character Icon inside round token */}
                    {guessChar ? (
                      guessChar.icon ? (
                        <img className="seat-char-img" src={guessChar.icon} alt={guessChar.name} style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <span className="seat-char-icon" style={{ color: TYPE_COLORS[guessChar.type] }}>
                          {guessChar.name?.charAt(0)}
                        </span>
                      )
                    ) : (
                      <span className="seat-empty" style={{ color: '#888', fontSize: '1.5rem', fontWeight: 'bold' }}>?</span>
                    )}

                    {/* Character Name inside token */}
                    {guessChar && (
                      <span className="seat-char-name" style={{ color: TYPE_COLORS[guessChar.type] }}>
                        {guessChar.name}
                      </span>
                    )}

                    {/* Label below token (INSIDE .seat-token so Grimoire bottom: -28px applies!) */}
                    <div className="seat-label">
                      <span className="seat-number">{seat.seatNumber}.</span>
                      <span className="seat-player-name" style={{ fontWeight: isMe ? 700 : 500, color: isMe ? '#e8c864' : '#eee' }}>
                        {seat.occupied ? seat.playerName : '空座'}
                        {isMe && ' ⭐'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* ── Seat Editor Popup when a round token is tapped ── */}
          {activeGuess !== null && (() => {
            const seat = seats.find(s => s.seatIndex === activeGuess);
            if (!seat) return null;
            const seatData = notebookData.seats[seat.seatIndex] || {};
            const guessCharId = seatData.charGuess;
            const guessChar = guessCharId ? allChars[guessCharId] : null;
            const searchVal = guessSearch[seat.seatIndex] || '';

            return (
              <div className="notebook-popup-overlay" onClick={() => setActiveGuess(null)}>
                <div className="notebook-seat-popup" onClick={e => e.stopPropagation()}>
                  <div className="notebook-popup-header">
                    <div>
                      <span className="notebook-popup-seatnum">#{seat.seatNumber}</span>
                      <span className="notebook-popup-playername">{seat.occupied ? seat.playerName : '空座'} {seat.seatIndex === mySeatIndex && '⭐'}</span>
                      {!seat.alive && <span className="notebook-popup-deadbadge">💀 已阵亡 (同说说书人)</span>}
                    </div>
                    <button className="notebook-popup-close" onClick={() => setActiveGuess(null)}>✕</button>
                  </div>

                  {/* Guessed role selection (Always allows changing/clearing!) */}
                  <div className="notebook-popup-section">
                    <label className="notebook-popup-label">猜测身份角色 (点击列表随时更换)</label>
                    {guessChar && (
                      <div className="notebook-guess-display" style={{ marginBottom: 6 }}>
                        {guessChar.icon && <img src={guessChar.icon} className="notebook-guess-display-icon" alt="" />}
                        <span className="notebook-guess-display-name" style={{ color: TYPE_COLORS[guessChar.type] }}>
                          当前猜测: {guessChar.name}
                        </span>
                        <button
                          className="notebook-guess-clear"
                          title="清除猜测"
                          onClick={() => updateSeatData(seat.seatIndex, 'charGuess', '')}
                        >✕</button>
                      </div>
                    )}
                    <div className="notebook-guess-wrapper">
                      <input
                        className="notebook-guess-input"
                        type="text"
                        placeholder={guessChar ? "搜索或直接选下方角色更换..." : "搜索角色名字或拼音/英文..."}
                        value={searchVal}
                        onChange={e => setGuessSearch(prev => ({ ...prev, [seat.seatIndex]: e.target.value }))}
                      />
                      {searchVal && (
                        <button className="notebook-guess-clear" onClick={() => setGuessSearch(prev => ({ ...prev, [seat.seatIndex]: '' }))}>✕</button>
                      )}
                      <div className="notebook-guess-dropdown" style={{ maxHeight: 170, display: 'block' }}>
                        {getFilteredChars(seat.seatIndex).map(c => (
                          <div
                            key={c.id}
                            className="notebook-guess-option"
                            onClick={() => {
                              updateSeatData(seat.seatIndex, 'charGuess', c.id);
                              setGuessSearch(prev => ({ ...prev, [seat.seatIndex]: '' }));
                            }}
                          >
                            {c.icon && <img src={c.icon} className="notebook-guess-option-icon" alt="" />}
                            <span className="notebook-guess-option-name">{c.name}</span>
                            <span className="notebook-guess-option-type" style={{ color: TYPE_COLORS[c.type], background: `${TYPE_COLORS[c.type]}18` }}>
                              {TYPE_LABELS[c.type] || c.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Notes textarea */}
                  <div className="notebook-popup-section">
                    <label className="notebook-popup-label">个人笔记 (仅自己可见)</label>
                    <textarea
                      className="notebook-notes-large"
                      placeholder="记录该玩家的线索、发言或可疑点..."
                      value={seatData.notes || ''}
                      onChange={e => updateSeatData(seat.seatIndex, 'notes', e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Death Date Table & Phase Selector right below the note */}
                  <div className="notebook-popup-section">
                    <label className="notebook-popup-label">💀 阵亡时间记录 (同步或自定义，同步至死亡日期表)</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        className="notebook-popup-select"
                        value={seatData.deathDay != null ? seatData.deathDay : (seat.deathDay != null ? seat.deathDay : '')}
                        onChange={e => updateSeatData(seat.seatIndex, 'deathDay', e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">-- 阵亡天数 (未记录) --</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(d => (
                          <option key={d} value={d}>第 {d} 天</option>
                        ))}
                      </select>
                      <select
                        className="notebook-popup-select"
                        value={seatData.deathPhase || (seat.deathCause?.includes('night') ? 'night' : seat.deathCause ? 'day' : '')}
                        onChange={e => updateSeatData(seat.seatIndex, 'deathPhase', e.target.value)}
                      >
                        <option value="">-- 阵亡时段 --</option>
                        <option value="day">☀️ 白天 (处决/放逐/白天死)</option>
                        <option value="night">🌙 夜晚 (恶魔杀/夜晚死)</option>
                      </select>
                    </div>
                  </div>

                  <button className="notebook-popup-done-btn" onClick={() => setActiveGuess(null)}>保存 / 完成</button>
                </div>
              </div>
            );
          })()}
        </div>
      );
    }

    // ── Character card view ──
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

          <div className="reveal-btn-row">
            <button className="reveal-btn" onClick={() => setShowingChar(false)}>🔒 隐藏</button>
            <button
              className="reveal-btn reveal-btn-notebook"
              onClick={() => setShowNotebook(true)}
            >
              📓 笔记本
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
