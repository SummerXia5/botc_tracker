import { useState, useMemo, useCallback } from 'react';
import { CHARACTERS, TYPE_COLORS, TYPE_LABELS, SCRIPTS } from '../data/characters';
import PlayerSelector from './PlayerSelector';
import './Grimoire.css';

const REMINDER_TOKENS = [
  { id: 'dead', label: '死亡', icon: '💀', color: '#d44' },
  { id: 'nodeath', label: '不会死亡', icon: '🛡️', color: '#4a9' },
  { id: 'drunk', label: '醉酒', icon: '🍺', color: '#c7a' },
  { id: 'poisoned', label: '中毒', icon: '☠️', color: '#9a4' },
  { id: 'noability', label: '失去能力', icon: '🔇', color: '#888' },
  { id: 'chosen', label: '被选择', icon: '👆', color: '#48c' },
  { id: 'mad', label: '疯狂', icon: '🤪', color: '#e84' },
  { id: 'good', label: '善良', icon: '😇', color: '#4a9' },
  { id: 'evil', label: '邪恶', icon: '😈', color: '#d44' },
  { id: 'used', label: '已使用', icon: '✓', color: '#888' },
  { id: 'ghost_vote', label: '投过票', icon: '👻', color: '#97c' },
  { id: 'grandchild', label: '孙子', icon: '👶', color: '#48c' },
  { id: 'custom', label: '自定义', icon: '📝', color: '#c7a' },
];

/**
 * Storyteller Grimoire — the core game-running tool.
 *
 * Props:
 *   players  — array of player objects from the group ({ id, name, emoji })
 *   scripts  — array of script objects from the group ({ id, name, characters })
 *   groupId  — current group ID
 *   onExportGame — callback receiving the finished game record
 *   onClose  — callback to close the grimoire view
 */
export default function Grimoire({ players, scripts, groupId, onExportGame, onClose, onRefreshPlayers }) {
  // Local players (can grow via quick-add)
  const [localPlayers, setLocalPlayers] = useState(players);
  // ---- Core state ----
  const [selectedScript, setSelectedScript] = useState(null);
  const [seats, setSeats] = useState([]);
  const [phase, setPhase] = useState('setup'); // 'setup' | 'day' | 'night'
  const [dayNumber, setDayNumber] = useState(0);

  // ---- UI panels ----
  const [showRolePanel, setShowRolePanel] = useState(false);
  const [assigningSeatIndex, setAssigningSeatIndex] = useState(null);
  const [showNightOrder, setShowNightOrder] = useState(false);
  const [showDemonBluffs, setShowDemonBluffs] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState(null);

  // ---- Demon bluffs ----
  const [demonBluffs, setDemonBluffs] = useState([null, null, null]);
  const [assigningBluffIndex, setAssigningBluffIndex] = useState(null);

  // ---- Game log ----
  const [log, setLog] = useState([]);

  // ---- Reminder tokens ----
  const [seatReminders, setSeatReminders] = useState({}); // { seatIndex: ['dead', 'drunk', 'custom:xxx', ...] }
  const [reminderSeatIndex, setReminderSeatIndex] = useState(null);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [customReminderText, setCustomReminderText] = useState('');

  // ---- Setup: player selection ----
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);

  // ----------------------------------------------------------------
  //  Available scripts: merge group scripts + built-in SCRIPTS
  // ----------------------------------------------------------------
  const allScripts = useMemo(() => {
    const builtInList = Object.values(SCRIPTS || {});
    const merged = [];
    const usedBuiltIn = new Set();

    // First, process API scripts — enrich with built-in characters if empty
    for (const s of (scripts || [])) {
      const match = builtInList.find(b =>
        s.name.includes(b.name) || s.name.includes(b.nameEn) ||
        b.name.includes(s.name) ||
        s.id === b.id
      );
      if (match && (!s.characters || s.characters.length === 0)) {
        merged.push({ ...s, characters: match.characters, _builtIn: true });
        usedBuiltIn.add(match.id);
      } else {
        merged.push({ ...s, _builtIn: false });
      }
    }

    // Add any built-in scripts not yet covered
    for (const b of builtInList) {
      if (!usedBuiltIn.has(b.id)) {
        merged.push({ ...b, _builtIn: true });
      }
    }

    return merged;
  }, [scripts]);

  // ----------------------------------------------------------------
  //  Characters available in the selected script
  // ----------------------------------------------------------------
  const scriptCharacters = useMemo(() => {
    if (!selectedScript) return [];
    const charIds = selectedScript.characters || [];
    // Parse char_meta from script (stored as JSON string in DB)
    let meta = {};
    try {
      meta = selectedScript.char_meta
        ? (typeof selectedScript.char_meta === 'string'
          ? JSON.parse(selectedScript.char_meta)
          : selectedScript.char_meta)
        : {};
    } catch { /* ignore parse errors */ }

    // Normalize an ID to try matching our CHARACTERS database
    const normalizeId = (rawId) => {
      // Strip common suffixes: CustomVER, _custom, etc.
      let id = rawId.replace(/Custom(?:VER)?$/i, '');
      // Check exact match
      if (CHARACTERS[id]) return CHARACTERS[id];
      // Try lowercase
      id = id.toLowerCase();
      if (CHARACTERS[id]) return CHARACTERS[id];
      // Try with underscores for multi-word (e.g. fortune_teller)
      id = id.replace(/\s+/g, '_');
      if (CHARACTERS[id]) return CHARACTERS[id];
      return null;
    };

    return charIds.map(id => {
      // 1. Direct match in local CHARACTERS database
      if (CHARACTERS[id]) return { ...CHARACTERS[id] };

      // 2. Try normalized match (strip CustomVER etc.)
      const normalized = normalizeId(id);

      // 3. Get metadata from imported script JSON
      const m = meta[id] || {};
      const teamMap = { townsfolk: 'townsfolk', outsider: 'outsider', minion: 'minion', demon: 'demon', fabled: 'fabled', traveler: 'townsfolk' };

      if (normalized) {
        // Merge: local data + script meta image as override
        return {
          ...normalized,
          id, // keep original ID for assignment tracking
          icon: m.image || normalized.icon, // prefer script image if available
        };
      }

      // 4. Fully custom character — use script metadata
      return {
        id,
        name: m.name || id.replace(/Custom(?:VER)?$/i, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        nameEn: '',
        type: teamMap[m.team] || 'townsfolk',
        ability: m.ability || '',
        icon: m.image || null,
        _unknown: true,
      };
    });
  }, [selectedScript]);

  // Lookup map: charId -> character data (handles CustomVER normalized chars)
  const charLookup = useMemo(() => {
    const map = {};
    for (const ch of scriptCharacters) {
      map[ch.id] = ch;
    }
    return map;
  }, [scriptCharacters]);

  const charactersByType = useMemo(() => {
    const groups = { townsfolk: [], outsider: [], minion: [], demon: [], fabled: [] };
    for (const ch of scriptCharacters) {
      if (groups[ch.type]) {
        groups[ch.type].push(ch);
      }
    }
    return groups;
  }, [scriptCharacters]);

  // Already-assigned character IDs
  const assignedCharIds = useMemo(() => {
    return new Set(seats.map(s => s.characterId).filter(Boolean));
  }, [seats]);

  // ----------------------------------------------------------------
  //  Night order (for the night-order panel)
  // ----------------------------------------------------------------
  const nightOrder = useMemo(() => {
    const isFirstNight = dayNumber === 0;
    const activeChars = seats
      .filter(s => s.characterId && s.alive)
      .map(s => charLookup[s.characterId] || CHARACTERS[s.characterId])
      .filter(Boolean);

    return activeChars
      .filter(ch => (isFirstNight ? ch.firstNight : ch.otherNights) > 0)
      .sort((a, b) => {
        const orderA = isFirstNight ? a.firstNight : a.otherNights;
        const orderB = isFirstNight ? b.firstNight : b.otherNights;
        return orderA - orderB;
      });
  }, [seats, dayNumber]);

  // ----------------------------------------------------------------
  //  Helpers
  // ----------------------------------------------------------------
  const addLog = useCallback((msg) => {
    setLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg }]);
  }, []);

  const togglePlayer = (id) => {
    setSelectedPlayerIds(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  // ----------------------------------------------------------------
  //  Setup: start game (populate seats)
  // ----------------------------------------------------------------
  const handleStartSetup = () => {
    if (!selectedScript || selectedPlayerIds.length < 5) return;
    const newSeats = selectedPlayerIds.map(pid => {
      const player = players.find(p => p.id === pid);
      return {
        player,
        characterId: null,
        alive: true,
        hasVoted: false,
        nominated: false,
      };
    });
    setSeats(newSeats);
    setPhase('setup');
    setDayNumber(0);
    addLog(`开始配置 · ${selectedScript.name} · ${newSeats.length} 名玩家`);
  };

  // ----------------------------------------------------------------
  //  BotC role distribution by player count
  // ----------------------------------------------------------------
  const ROLE_DISTRIBUTION = {
    5:  { townsfolk: 3, outsider: 0, minion: 1, demon: 1 },
    6:  { townsfolk: 3, outsider: 1, minion: 1, demon: 1 },
    7:  { townsfolk: 5, outsider: 0, minion: 1, demon: 1 },
    8:  { townsfolk: 5, outsider: 1, minion: 1, demon: 1 },
    9:  { townsfolk: 5, outsider: 2, minion: 1, demon: 1 },
    10: { townsfolk: 7, outsider: 0, minion: 2, demon: 1 },
    11: { townsfolk: 7, outsider: 1, minion: 2, demon: 1 },
    12: { townsfolk: 7, outsider: 2, minion: 2, demon: 1 },
    13: { townsfolk: 9, outsider: 0, minion: 3, demon: 1 },
    14: { townsfolk: 9, outsider: 1, minion: 3, demon: 1 },
    15: { townsfolk: 9, outsider: 2, minion: 3, demon: 1 },
  };

  const [showDistribution, setShowDistribution] = useState(false);
  const [selectedCharPool, setSelectedCharPool] = useState(new Set());

  // Select all characters into pool
  const selectAllChars = useCallback(() => {
    setSelectedCharPool(new Set(scriptCharacters.map(c => c.id)));
  }, [scriptCharacters]);

  // Deselect all
  const deselectAllChars = useCallback(() => {
    setSelectedCharPool(new Set());
  }, []);

  const toggleCharInPool = (charId) => {
    setSelectedCharPool(prev => {
      const next = new Set(prev);
      if (next.has(charId)) {
        next.delete(charId);
      } else {
        // Enforce per-type limit (fabled has no limit)
        const ch = charLookup[charId];
        if (ch && ch.type !== 'fabled' && currentDistribution[ch.type] !== undefined) {
          const currentCount = [...next].filter(id => {
            const c = charLookup[id];
            return c && c.type === ch.type;
          }).length;
          if (currentCount >= currentDistribution[ch.type]) {
            return prev; // Already at limit for this type
          }
        }
        next.add(charId);
      }
      return next;
    });
  };

  // Count SELECTED characters per type (characters user picked to be "in play")
  const selectedCountByType = useMemo(() => {
    const counts = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };
    for (const id of selectedCharPool) {
      const ch = charLookup[id];
      if (ch && counts[ch.type] !== undefined) {
        counts[ch.type]++;
      }
    }
    return counts;
  }, [selectedCharPool, charLookup]);

  const currentDistribution = useMemo(() => {
    const count = seats.length;
    return ROLE_DISTRIBUTION[count] || ROLE_DISTRIBUTION[Math.min(count, 15)] || { townsfolk: 3, outsider: 0, minion: 1, demon: 1 };
  }, [seats.length]);

  // Shuffle helper
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Mode 1: "随机配版" — auto-pick the right number of each type, SELECT only (don't assign)
  const handleAutoPickAndAssign = () => {
    if (!selectedScript || seats.length < 5) return;
    const dist = currentDistribution;
    const picked = new Set();

    for (const type of ['townsfolk', 'outsider', 'minion', 'demon']) {
      const available = shuffle(charactersByType[type] || []);
      const needed = dist[type] || 0;
      for (let i = 0; i < Math.min(needed, available.length); i++) {
        picked.add(available[i].id);
      }
    }

    setSelectedCharPool(picked);
    addLog(`随机配版：已选 ${picked.size} 个角色`);
  };

  // Mode 2: "随机发放" — take the manually selected characters and randomly assign to seats
  const handleDistributeSelected = () => {
    // Only non-fabled characters get assigned to seats
    const nonFabled = [...selectedCharPool].filter(id => {
      const ch = charLookup[id];
      return ch && ch.type !== 'fabled';
    });
    if (nonFabled.length !== seats.length || seats.length < 5) return;
    const selectedIds = shuffle(nonFabled);
    setSeats(prev => prev.map((s, i) => ({
      ...s,
      characterId: selectedIds[i] || null,
    })));
    addLog(`随机发放 ${selectedIds.length} 个已选角色`);
    setShowDistribution(false);
  };

  const handleOpenDistribution = () => {
    setShowDistribution(true);
  };

  // ----------------------------------------------------------------
  //  Role assignment
  // ----------------------------------------------------------------
  const handleSeatClick = (index) => {
    // If in setup phase and no character yet, open role panel
    if (phase === 'setup' || !seats[index].characterId) {
      setAssigningSeatIndex(index);
      setShowRolePanel(true);
      return;
    }
    // Otherwise toggle alive/dead
    setSeats(prev => prev.map((s, i) => {
      if (i !== index) return s;
      const newAlive = !s.alive;
      addLog(`${s.player.name} ${newAlive ? '复活' : '死亡'}`);
      return { ...s, alive: newAlive, hasVoted: newAlive ? s.hasVoted : false };
    }));
  };

  const handleAssignRole = (charId) => {
    if (assigningSeatIndex === null) return;
    setSeats(prev => prev.map((s, i) => {
      if (i !== assigningSeatIndex) return s;
      return { ...s, characterId: charId };
    }));
    const ch = charLookup[charId] || CHARACTERS[charId];
    const seatPlayer = seats[assigningSeatIndex]?.player;
    if (ch && seatPlayer) {
      addLog(`${seatPlayer.name} → ${ch.name}`);
    }
    setShowRolePanel(false);
    setAssigningSeatIndex(null);
  };

  // ----------------------------------------------------------------
  //  Phase transitions
  // ----------------------------------------------------------------
  const handleStartDay = () => {
    const newDay = dayNumber + 1;
    setPhase('day');
    setDayNumber(newDay);
    // Reset nominations/votes
    setSeats(prev => prev.map(s => ({ ...s, nominated: false, hasVoted: false })));
    addLog(`白天 ${newDay} 开始`);
  };

  const handleStartNight = () => {
    setPhase('night');
    // Reset nominations/votes
    setSeats(prev => prev.map(s => ({ ...s, nominated: false, hasVoted: false })));
    addLog(`夜晚 ${dayNumber} 开始`);
  };

  // ----------------------------------------------------------------
  //  Nomination & voting
  // ----------------------------------------------------------------
  const handleNominate = (index) => {
    setSeats(prev => prev.map((s, i) => ({
      ...s,
      nominated: i === index ? !s.nominated : s.nominated,
    })));
    const name = seats[index]?.player?.name || '';
    addLog(`${name} 被提名`);
  };

  const handleVote = (index) => {
    setSeats(prev => prev.map((s, i) => {
      if (i !== index) return s;
      return { ...s, hasVoted: !s.hasVoted };
    }));
  };

  const toggleReminder = (seatIdx, reminderId) => {
    setSeatReminders(prev => {
      const current = prev[seatIdx] || [];
      const has = current.includes(reminderId);
      return {
        ...prev,
        [seatIdx]: has
          ? current.filter(r => r !== reminderId)
          : [...current, reminderId],
      };
    });
  };

  const voteCount = useMemo(() => {
    return seats.filter(s => s.hasVoted).length;
  }, [seats]);

  const aliveCount = useMemo(() => {
    return seats.filter(s => s.alive).length;
  }, [seats]);

  const hasNomination = seats.some(s => s.nominated);

  // ----------------------------------------------------------------
  //  Demon bluffs
  // ----------------------------------------------------------------
  const handleAssignBluff = (charId) => {
    if (assigningBluffIndex === null) return;
    setDemonBluffs(prev => {
      const next = [...prev];
      next[assigningBluffIndex] = charId;
      return next;
    });
    setAssigningBluffIndex(null);
  };

  // ----------------------------------------------------------------
  //  End game / export
  // ----------------------------------------------------------------
  const handleEndGame = () => {
    if (!selectedWinner) return;
    const gameData = {
      script: selectedScript.name,
      date: new Date().toISOString().split('T')[0],
      winner: selectedWinner,
      participants: seats.map(s => ({
        player_id: s.player.id,
        role_type: (charLookup[s.characterId] || CHARACTERS[s.characterId])?.type || 'townsfolk',
        survived: s.alive,
      })),
    };
    onExportGame?.(gameData);
    addLog(`对局结束 · ${selectedWinner === 'good' ? '善良' : '邪恶'}阵营获胜`);
    setShowEndDialog(false);
  };

  // ================================================================
  //  Render: Script + player selection (before seats exist)
  // ================================================================
  if (seats.length === 0) {
    return (
      <div className="grimoire">
        <div className="grimoire-setup">
          <div className="grimoire-setup-header">
            <h2 className="grimoire-title">说书人魔典 <span className="grimoire-beta-tag">Beta</span></h2>
            <p className="grimoire-subtitle">STORYTELLER GRIMOIRE</p>
            <button className="grimoire-close-btn" onClick={onClose}>✕</button>
          </div>

          <div className="grimoire-beta-banner">
            <strong>⚠ Beta 测试中</strong> — 此功能仍在开发中，部分功能可能不完善。不会影响已有的玩家数据和对局记录。
          </div>

          {/* Step 1: Select script */}
          <div className="grimoire-setup-section">
            <label className="grimoire-label">选择剧本</label>
            <div className="grimoire-script-list">
              {allScripts.map(s => (
                <button
                  key={s.name}
                  type="button"
                  className={`grimoire-script-item ${selectedScript?.name === s.name ? 'active' : ''}`}
                  onClick={() => setSelectedScript(s)}
                >
                  <span className="grimoire-script-name">{s.name}</span>
                  <span className="grimoire-script-count">
                    {s.characters?.length || 0} 角色
                  </span>
                  {s._builtIn && <span className="grimoire-script-badge">内置</span>}
                </button>
              ))}
              {allScripts.length === 0 && (
                <p className="grimoire-empty">暂无可用剧本</p>
              )}
            </div>
          </div>

          {/* Step 2: Select players */}
          <div className="grimoire-setup-section">
            <PlayerSelector
              players={localPlayers}
              selectedIds={selectedPlayerIds}
              onToggle={togglePlayer}
              groupId={groupId}
              label="选择玩家"
              minCount={5}
              variant="dark"
              onPlayerCreated={(newPlayer) => {
                setLocalPlayers(prev => [...prev, newPlayer]);
                onRefreshPlayers?.();
              }}
            />
          </div>

          {/* Start button */}
          <button
            className="grimoire-start-btn"
            disabled={!selectedScript || selectedPlayerIds.length < 5}
            onClick={handleStartSetup}
          >
            开始配置 ({selectedPlayerIds.length} 人)
          </button>
        </div>
      </div>
    );
  }

  // ================================================================
  //  Render: Active Grimoire
  // ================================================================
  const allAssigned = seats.every(s => s.characterId);

  return (
    <div className="grimoire">
      {/* ---- Phase indicator (top bar) ---- */}
      <div className="grimoire-phase-bar">
        <div className={`grimoire-phase-pill phase-${phase}`}>
          {phase === 'setup' && '⚙ 配置中'}
          {phase === 'day' && `☀ 白天 ${dayNumber}`}
          {phase === 'night' && `☽ 夜晚 ${dayNumber}`}
        </div>
        {phase === 'day' && hasNomination && (
          <div className="grimoire-vote-counter">
            投票: {voteCount} / {aliveCount}
          </div>
        )}
        <button className="grimoire-close-btn grimoire-close-ingame" onClick={onClose} style={{ position: 'absolute', right: 12, top: 8 }}>✕</button>
      </div>

      {/* ---- Circular seating chart ---- */}
      <div className="grimoire-circle-container">
        <div className="grimoire-circle">
          {/* Center decorative area */}
          <div className="grimoire-center">
            <div className="grimoire-center-name">{selectedScript?.name}</div>
            <div className="grimoire-center-sub">{selectedScript?.nameEn || 'CUSTOM SCRIPT'}</div>
            <div className="grimoire-center-count">{aliveCount} / {seats.length}</div>
          </div>

          {seats.map((seat, i) => {
            const seatCount = seats.length;
            const angle = (i / seatCount) * 2 * Math.PI - Math.PI / 2;
            const radius = 38;
            const x = 50 + radius * Math.cos(angle);
            const y = 50 + radius * Math.sin(angle);
            const ch = seat.characterId ? (charLookup[seat.characterId] || CHARACTERS[seat.characterId]) : null;

            return (
              <div
                key={seat.player.id}
                className={[
                  'seat-token',
                  !seat.alive && 'dead',
                  ch && `type-${ch.type}`,
                  seat.nominated && 'nominated',
                ].filter(Boolean).join(' ')}
                style={{ left: `${x}%`, top: `${y}%` }}
                onClick={() => handleSeatClick(i)}
              >
                {/* Dead shroud overlay */}
                {!seat.alive && <div className="seat-shroud" />}

                {/* Alive indicator dot */}
                {seat.alive && <div className="seat-alive-dot" />}

                {/* Character content */}
                {ch ? (
                  <>
                    {ch.icon ? (
                      <img className="seat-char-img" src={ch.icon} alt={ch.name} />
                    ) : (
                      <span className="seat-char-icon" style={{ color: TYPE_COLORS[ch.type] }}>
                        {ch.name?.charAt(0)}
                      </span>
                    )}
                    <span className="seat-char-name">{ch.name}</span>
                  </>
                ) : (
                  <span className="seat-empty">?</span>
                )}

                {/* Seat label bar below token */}
                <div className="seat-label">
                  <span className="seat-number">{i + 1}.</span>
                  <span className="seat-player-name">{seat.player.name}</span>
                </div>

                {/* Vote marker */}
                {seat.hasVoted && <div className="seat-vote-marker">V</div>}

                {/* Reminder button */}
                <button
                  className="seat-reminder-btn"
                  onClick={e => { e.stopPropagation(); setReminderSeatIndex(i); setShowReminderPicker(true); }}
                  title="添加标记"
                >
                  +
                </button>

                {/* Active reminders display — circular tokens */}
                {seatReminders[i]?.length > 0 && (
                  <div className="seat-reminders" onClick={e => e.stopPropagation()}>
                    {seatReminders[i].map((rid, ri) => {
                      const isCustom = rid.startsWith('custom:');
                      const token = isCustom ? null : REMINDER_TOKENS.find(t => t.id === rid);
                      const icon = isCustom ? '📝' : (token?.icon || '?');
                      const label = isCustom ? rid.replace('custom:', '') : (token?.label || rid);
                      // Fan out tokens in a cascade below the seat
                      const offsetX = (ri - (seatReminders[i].length - 1) / 2) * 28;
                      const offsetY = 8 + ri * 4;
                      return (
                        <div
                          key={ri}
                          className="seat-reminder-token"
                          title={label}
                          style={{
                            transform: `translate(${offsetX}px, ${offsetY}px)`,
                            zIndex: 10 + ri,
                          }}
                          onClick={() => { setReminderSeatIndex(i); setShowReminderPicker(true); }}
                        >
                          <span className="reminder-token-icon">{icon}</span>
                          <span className="reminder-token-text">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Day-phase action buttons */}
                {phase === 'day' && seat.alive && (
                  <div className="seat-actions" onClick={e => e.stopPropagation()}>
                    <button
                      className={`seat-action-btn ${seat.nominated ? 'action-active' : ''}`}
                      onClick={() => handleNominate(i)}
                      title="提名"
                    >
                      提名
                    </button>
                    {hasNomination && (
                      <button
                        className={`seat-action-btn seat-vote-btn ${seat.hasVoted ? 'action-active' : ''}`}
                        onClick={() => handleVote(i)}
                        title="投票"
                      >
                        票
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Bottom Action Bar ---- */}
      <div className="grimoire-action-bar">
        {/* Phase transition button */}
        {phase === 'setup' && allAssigned && (
          <button className="action-bar-btn action-primary" onClick={handleStartDay}>
            开始白天
          </button>
        )}
        {phase === 'setup' && (
          <>
            <button
              className={`action-bar-btn ${showDistribution ? 'action-active' : ''}`}
              onClick={handleOpenDistribution}
            >
              分配角色
            </button>
            <button className="action-bar-btn" onClick={handleAutoPickAndAssign}>
              🎲 随机配版
            </button>
          </>
        )}
        {phase === 'setup' && !allAssigned && (
          <span className="action-bar-hint">
            还需分配 {seats.filter(s => !s.characterId).length} 个角色
          </span>
        )}
        {phase === 'day' && (
          <button className="action-bar-btn action-primary" onClick={handleStartNight}>
            开始夜晚
          </button>
        )}
        {phase === 'night' && (
          <button className="action-bar-btn action-primary" onClick={handleStartDay}>
            开始白天
          </button>
        )}

        <div className="action-bar-divider" />

        {/* Secondary actions */}
        <button
          className={`action-bar-btn ${showNightOrder ? 'action-active' : ''}`}
          onClick={() => { setShowNightOrder(!showNightOrder); setShowDemonBluffs(false); }}
        >
          夜晚顺序
        </button>
        <button
          className={`action-bar-btn ${showDemonBluffs ? 'action-active' : ''}`}
          onClick={() => { setShowDemonBluffs(!showDemonBluffs); setShowNightOrder(false); }}
        >
          恶魔伪装
        </button>
        <button
          className="action-bar-btn action-end"
          onClick={() => setShowEndDialog(true)}
        >
          结束对局
        </button>
      </div>

      {/* ---- Role Assignment Panel (slide-up) ---- */}
      {showRolePanel && (
        <div className="grimoire-panel-overlay" onClick={() => { setShowRolePanel(false); setAssigningSeatIndex(null); }}>
          <div className="grimoire-role-panel" onClick={e => e.stopPropagation()}>
            <div className="role-panel-header">
              <h3>
                分配角色
                {assigningSeatIndex !== null && seats[assigningSeatIndex] && (
                  <> — {seats[assigningSeatIndex].player.name}</>
                )}
              </h3>
              <button className="role-panel-close" onClick={() => { setShowRolePanel(false); setAssigningSeatIndex(null); }}>✕</button>
            </div>
            <div className="role-panel-content">
              {['townsfolk', 'outsider', 'minion', 'demon'].map(type => {
                const chars = charactersByType[type];
                if (!chars || chars.length === 0) return null;
                return (
                  <div key={type} className="role-panel-group">
                    <div className="role-panel-group-label" style={{ color: TYPE_COLORS[type] }}>
                      {TYPE_LABELS[type]}
                    </div>
                    <div className="role-panel-grid">
                      {chars.map(ch => {
                        const isAssigned = assignedCharIds.has(ch.id);
                        return (
                          <button
                            key={ch.id}
                            className={`role-panel-item ${isAssigned ? 'role-assigned' : ''}`}
                            disabled={isAssigned}
                            onClick={() => handleAssignRole(ch.id)}
                          >
                            {ch.icon ? (
                              <img className="role-item-icon" src={ch.icon} alt={ch.name} />
                            ) : (
                              <span className="role-item-indicator" style={{ background: TYPE_COLORS[ch.type] }} />
                            )}
                            <span className="role-item-name">{ch.name}</span>
                            {ch.nameEn && <span className="role-item-en">{ch.nameEn}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---- Distribution Panel (character grid) ---- */}
      {showDistribution && (
        <div className="grimoire-panel-overlay" onClick={() => setShowDistribution(false)}>
          <div className="grimoire-distribution-panel" onClick={e => e.stopPropagation()}>
            <div className="role-panel-header">
              <h3>为当前 {seats.length} 个玩家选择角色:</h3>
              <button className="role-panel-close" onClick={() => setShowDistribution(false)}>✕</button>
            </div>

            <div className="distribution-body">
              {/* Left: type count indicators */}
              <div className="distribution-counts">
                {['townsfolk', 'outsider', 'minion', 'demon'].map(type => {
                  const needed = currentDistribution[type] || 0;
                  const selected = selectedCountByType[type] || 0;
                  const enough = selected >= needed;
                  return (
                    <div
                      key={type}
                      className={`dist-count-pill ${enough ? 'enough' : 'not-enough'}`}
                      style={{ borderColor: TYPE_COLORS[type], color: TYPE_COLORS[type] }}
                      title={`${TYPE_LABELS[type]}: 已选 ${selected} / 需要 ${needed}`}
                    >
                      {selected} / {needed}
                    </div>
                  );
                })}
              </div>

              {/* Right: character grid */}
              <div className="distribution-grid">
                {['townsfolk', 'outsider', 'minion', 'demon', ...(charactersByType.fabled?.length ? ['fabled'] : [])].map(type => (
                  (charactersByType[type] || []).map(ch => {
                    const isSelected = selectedCharPool.has(ch.id);
                    const isAssigned = assignedCharIds.has(ch.id);
                    return (
                      <div
                        key={ch.id}
                        className={`dist-token ${isSelected ? 'selected' : 'deselected'} ${isAssigned ? 'assigned' : ''}`}
                        style={{
                          borderColor: isSelected ? TYPE_COLORS[ch.type] : 'rgba(100,80,50,0.2)',
                          boxShadow: isSelected ? `0 0 8px ${TYPE_COLORS[ch.type]}50` : 'none',
                        }}
                        title={`${ch.name} (${ch.nameEn}) — ${TYPE_LABELS[ch.type]}\n${ch.ability}`}
                        onClick={() => toggleCharInPool(ch.id)}
                      >
                        {ch.icon ? (
                          <img className="dist-token-img" src={ch.icon} alt={ch.name} style={{ opacity: isSelected ? 1 : 0.3 }} />
                        ) : (
                          <span className="dist-token-icon" style={{ color: isSelected ? TYPE_COLORS[ch.type] : '#666' }}>
                            {ch.name?.charAt(0)}
                          </span>
                        )}
                        <span className="dist-token-name" style={{ opacity: isSelected ? 1 : 0.4 }}>{ch.name}</span>
                        {isAssigned && <div className="dist-token-check">✓</div>}
                      </div>
                    );
                  })
                ))}
              </div>
            </div>

            <div className="distribution-actions">
              <button className="action-bar-btn action-primary" onClick={handleAutoPickAndAssign}>
                🎲 随机配版
              </button>
              {(() => {
                const nonFabledCount = [...selectedCharPool].filter(id => {
                  const ch = charLookup[id];
                  return ch && ch.type !== 'fabled';
                }).length;
                return (
                  <button className="action-bar-btn action-primary" onClick={handleDistributeSelected}
                    disabled={nonFabledCount !== seats.length}
                    style={{ opacity: nonFabledCount !== seats.length ? 0.4 : 1 }}
                  >
                    🎯 随机发放 ({nonFabledCount}/{seats.length})
                  </button>
                );
              })()}
              <button className="action-bar-btn" onClick={() => {
                setSeats(prev => prev.map(s => ({ ...s, characterId: null })));
                addLog('已重置所有角色分配');
              }}>
                重置角色
              </button>
              <button className="action-bar-btn" onClick={deselectAllChars}>
                清空选择
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Reminder Token Picker ---- */}
      {showReminderPicker && reminderSeatIndex !== null && (
        <div className="grimoire-panel-overlay" onClick={() => setShowReminderPicker(false)}>
          <div className="reminder-picker" onClick={e => e.stopPropagation()}>
            <div className="reminder-picker-header">
              <h3>选择备忘标记 — {seats[reminderSeatIndex]?.player?.name}</h3>
              <button className="modal-close" onClick={() => setShowReminderPicker(false)}>✕</button>
            </div>
            <div className="reminder-grid">
              {REMINDER_TOKENS.filter(t => t.id !== 'custom').map(token => {
                const isActive = (seatReminders[reminderSeatIndex] || []).includes(token.id);
                return (
                  <button
                    key={token.id}
                    className={`reminder-token ${isActive ? 'reminder-active' : ''}`}
                    style={{ '--token-color': token.color }}
                    onClick={() => toggleReminder(reminderSeatIndex, token.id)}
                  >
                    <span className="reminder-token-icon">{token.icon}</span>
                    <span className="reminder-token-label">{token.label}</span>
                  </button>
                );
              })}
            </div>
            {/* Custom reminder input */}
            <div className="reminder-custom-input">
              <input
                type="text"
                placeholder="输入自定义标记..."
                value={customReminderText}
                onChange={e => setCustomReminderText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && customReminderText.trim()) {
                    const customId = `custom:${customReminderText.trim()}`;
                    setSeatReminders(prev => ({
                      ...prev,
                      [reminderSeatIndex]: [...(prev[reminderSeatIndex] || []), customId],
                    }));
                    setCustomReminderText('');
                  }
                }}
                className="reminder-custom-field"
              />
              <button
                className="reminder-custom-add"
                disabled={!customReminderText.trim()}
                onClick={() => {
                  if (!customReminderText.trim()) return;
                  const customId = `custom:${customReminderText.trim()}`;
                  setSeatReminders(prev => ({
                    ...prev,
                    [reminderSeatIndex]: [...(prev[reminderSeatIndex] || []), customId],
                  }));
                  setCustomReminderText('');
                }}
              >
                添加
              </button>
            </div>
            {/* Show current reminders with remove option */}
            {seatReminders[reminderSeatIndex]?.length > 0 && (
              <div className="reminder-current">
                <span>当前标记：</span>
                {seatReminders[reminderSeatIndex].map((rid, ri) => {
                  const isCustom = rid.startsWith('custom:');
                  const token = isCustom ? null : REMINDER_TOKENS.find(t => t.id === rid);
                  const label = isCustom ? rid.replace('custom:', '') : (token?.label || rid);
                  const icon = isCustom ? '📝' : (token?.icon || '?');
                  return (
                    <span key={ri} className="reminder-current-tag" onClick={() => toggleReminder(reminderSeatIndex, rid)}>
                      {icon} {label} ✕
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Night Order Panel (slide-in right) ---- */}
      {showNightOrder && (
        <div className="grimoire-side-panel">
          <div className="side-panel-header">
            <h3>{dayNumber === 0 ? '首夜顺序' : '其他夜晚顺序'}</h3>
            <button className="side-panel-close" onClick={() => setShowNightOrder(false)}>✕</button>
          </div>
          <div className="side-panel-content">
            {nightOrder.length === 0 ? (
              <p className="side-panel-empty">暂无需要唤醒的角色</p>
            ) : (
              nightOrder.map((ch, i) => {
                const order = dayNumber === 0 ? ch.firstNight : ch.otherNights;
                return (
                  <div key={ch.id} className="night-order-item">
                    <span className="night-order-num">{i + 1}</span>
                    <span className="night-order-indicator" style={{ background: TYPE_COLORS[ch.type] }} />
                    <div className="night-order-info">
                      <span className="night-order-name" style={{ color: TYPE_COLORS[ch.type] }}>{ch.name}</span>
                      {ch.ability && (
                        <span className="night-order-ability">{ch.ability}</span>
                      )}
                    </div>
                    <span className="night-order-original">({order})</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ---- Demon Bluffs Panel ---- */}
      {showDemonBluffs && (
        <div className="grimoire-side-panel">
          <div className="side-panel-header">
            <h3>恶魔伪装</h3>
            <button className="side-panel-close" onClick={() => { setShowDemonBluffs(false); setAssigningBluffIndex(null); }}>✕</button>
          </div>
          <div className="side-panel-content">
            <p className="side-panel-hint">选择3个不在场的好人角色作为伪装选项</p>
            <div className="bluff-slots">
              {demonBluffs.map((bluffId, bi) => {
                const ch = bluffId ? (charLookup[bluffId] || CHARACTERS[bluffId]) : null;
                return (
                  <button
                    key={bi}
                    className={`bluff-slot ${assigningBluffIndex === bi ? 'bluff-selecting' : ''}`}
                    onClick={() => setAssigningBluffIndex(assigningBluffIndex === bi ? null : bi)}
                  >
                    {ch ? (
                      <>
                        {ch.icon ? (
                          <img className="bluff-icon" src={ch.icon} alt={ch.name} />
                        ) : (
                          <span className="bluff-indicator" style={{ background: TYPE_COLORS[ch.type] }} />
                        )}
                        <span className="bluff-name">{ch.name}</span>
                      </>
                    ) : (
                      <span className="bluff-empty">选择伪装 {bi + 1}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {assigningBluffIndex !== null && (
              <div className="bluff-picker">
                {scriptCharacters
                  .filter(ch => ch.type === 'townsfolk' || ch.type === 'outsider')
                  .filter(ch => !assignedCharIds.has(ch.id))
                  .map(ch => (
                    <button
                      key={ch.id}
                      className="bluff-picker-item"
                      onClick={() => handleAssignBluff(ch.id)}
                    >
                      {ch.icon ? (
                        <img className="role-item-icon" src={ch.icon} alt={ch.name} />
                      ) : (
                        <span className="role-item-indicator" style={{ background: TYPE_COLORS[ch.type] }} />
                      )}
                      <span>{ch.name}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- End Game Dialog ---- */}
      {showEndDialog && (
        <div className="grimoire-panel-overlay" onClick={() => setShowEndDialog(false)}>
          <div className="grimoire-end-dialog" onClick={e => e.stopPropagation()}>
            <h3>结束对局</h3>
            <p className="end-dialog-hint">选择获胜阵营</p>
            <div className="end-dialog-options">
              <button
                className={`end-option ${selectedWinner === 'good' ? 'end-option-active end-good' : ''}`}
                onClick={() => setSelectedWinner('good')}
              >
                善良阵营
              </button>
              <button
                className={`end-option ${selectedWinner === 'evil' ? 'end-option-active end-evil' : ''}`}
                onClick={() => setSelectedWinner('evil')}
              >
                邪恶阵营
              </button>
            </div>
            <div className="end-dialog-actions">
              <button className="btn-ghost" onClick={() => setShowEndDialog(false)}>取消</button>
              <button
                className="btn-primary"
                disabled={!selectedWinner}
                onClick={handleEndGame}
              >
                确认结束
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Game Log (collapsible at bottom-right) ---- */}
      {log.length > 0 && (
        <details className="grimoire-log">
          <summary className="grimoire-log-toggle">日志 ({log.length})</summary>
          <div className="grimoire-log-content">
            {log.slice().reverse().map((entry, i) => (
              <div key={i} className="log-entry">
                <span className="log-time">{entry.time}</span>
                <span className="log-msg">{entry.msg}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
